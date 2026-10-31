import { NextResponse } from 'next/server'
import { db } from '@/lib/auth/db'
import { applySuccessfulCharge } from '@/lib/billing/apply'
import { notifyAccessEnded, notifyRenewalReminder } from '@/lib/billing/notify'
import { formatNaira, getPricing } from '@/lib/billing/pricing'

export const dynamic = 'force-dynamic'

/** Hourly billing upkeep: settle stale checkouts, end lapsed plans, remind the
 *  people who pay by hand. Safe to run twice at once: every transition is a
 *  guarded update, so only the run that wins it sends the email. */

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const STALE_AFTER = 15 * MINUTE
const ABANDON_AFTER = DAY
const GIVE_UP_AFTER = 2 * DAY
const GRACE = 3 * DAY

type PaymentRow = { id: string; reference: string; created_at: string }
type EntitlementRow = { user_id: string; plan: 'monthly_auto' | 'monthly_manual' | 'lifetime'; status: 'active' | 'past_due' | 'cancelled' | 'expired'; current_period_end: string | null; cancel_at_period_end: boolean; last_reminder_kind?: string | null }

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
const enc = (value: string) => encodeURIComponent(value)
const authorised = (request: Request) => Boolean(process.env.CRON_SECRET) && request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`

/** Payment rows created at this moment already passed through checkout. */
async function reconcilePending(now: number) {
  let reconciled = 0
  const pending = await db<PaymentRow[]>('payments', {}, `?select=id,reference,created_at&status=eq.pending&created_at=lt.${enc(new Date(now - STALE_AFTER).toISOString())}&created_at=gt.${enc(new Date(now - GIVE_UP_AFTER).toISOString())}&order=created_at.asc&limit=50`)
  for (const payment of pending ?? []) {
    const age = now - Date.parse(payment.created_at)
    const result = await applySuccessfulCharge(payment.reference, 'callback').catch(() => null)
    if (result && result.outcome !== 'pending') {
      reconciled += 1
      continue
    }
    // No answer after a day: the person has long left the checkout.
    if (age >= ABANDON_AFTER) {
      const flipped = await db<Array<{ id: string }>>('payments', { method: 'PATCH', body: JSON.stringify({ status: 'abandoned' }) }, `?id=eq.${enc(payment.id)}&status=eq.pending`)
      if (Array.isArray(flipped) && flipped.length === 1) reconciled += 1
    }
  }
  return reconciled
}

async function expireLapsed(now: number) {
  let expired = 0
  const stamp = new Date(now).toISOString()
  const due = await db<EntitlementRow[]>('entitlements', {}, `?select=user_id,plan,status,current_period_end,cancel_at_period_end&status=in.(active,cancelled,past_due)&current_period_end=lt.${enc(stamp)}&limit=200`)

  for (const row of due ?? []) {
    const end = row.current_period_end ? Date.parse(row.current_period_end) : Number.NaN
    if (!Number.isFinite(end)) continue

    // A live automatic renewal gets three days of grace while Paystack retries,
    // which is exactly what a past-due row means.
    if (row.plan === 'monthly_auto' && !row.cancel_at_period_end && now <= end + GRACE) {
      if (row.status !== 'past_due') {
        await db('entitlements', { method: 'PATCH', body: JSON.stringify({ status: 'past_due', updated_at: stamp }) }, `?user_id=eq.${enc(row.user_id)}&status=eq.${row.status}`)
      }
      continue
    }

    const flipped = await db<Array<{ user_id: string }>>('entitlements', { method: 'PATCH', body: JSON.stringify({ status: 'expired', updated_at: stamp }) }, `?user_id=eq.${enc(row.user_id)}&status=eq.${row.status}`)
    if (Array.isArray(flipped) && flipped.length === 1) {
      expired += 1
      await notifyAccessEnded(row.user_id, row.current_period_end)
    }
  }
  return expired
}

/** Hand-paid months and plans already switched off: '3d' then '0d'. */
async function remindEnding(now: number) {
  let reminded = 0
  const stamp = new Date(now).toISOString()
  const amountLabel = formatNaira((await getPricing()).monthlyKobo)
  const ending = await db<EntitlementRow[]>('entitlements', {}, `?select=user_id,plan,status,current_period_end,cancel_at_period_end,last_reminder_kind&status=in.(active,cancelled,past_due)&current_period_end=gt.${enc(stamp)}&or=(plan.eq.monthly_manual,and(plan.eq.monthly_auto,cancel_at_period_end.is.true),status.eq.cancelled)&limit=200`)

  for (const row of ending ?? []) {
    const end = row.current_period_end ? Date.parse(row.current_period_end) : Number.NaN
    if (!Number.isFinite(end)) continue
    const remaining = end - now
    const kind = remaining <= DAY ? '0d' : remaining <= 3 * DAY ? '3d' : null
    if (!kind || row.last_reminder_kind === kind) continue

    // Claim the reminder before sending it, so two runs cannot send two emails.
    const claimed = await db<Array<{ user_id: string }>>('entitlements', {
      method: 'PATCH',
      body: JSON.stringify({ last_reminder_at: stamp, last_reminder_kind: kind, updated_at: stamp }),
    }, `?user_id=eq.${enc(row.user_id)}&or=(last_reminder_kind.is.null,last_reminder_kind.neq.${kind})`).catch(() => null)
    if (!Array.isArray(claimed) || claimed.length !== 1) continue

    await notifyRenewalReminder(row.user_id, kind, amountLabel)
    reminded += 1
  }
  return reminded
}

async function run() {
  const now = Date.now()
  const reconciled = await reconcilePending(now)
  const expired = await expireLapsed(now)
  const reminded = await remindEnding(now)
  return { reconciled, expired, reminded }
}

export async function GET(request: Request) {
  if (!authorised(request)) return json({ error: 'Unauthorized' }, 401)
  try {
    return json(await run())
  } catch {
    return json({ error: 'Billing upkeep failed' }, 500)
  }
}

export async function POST(request: Request) {
  return GET(request)
}
