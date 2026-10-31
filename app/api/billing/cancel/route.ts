import { NextResponse } from 'next/server'
import { assertSameOrigin } from '@/lib/auth/origin'
import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/auth/db'
import { disableSubscription } from '@/lib/billing/paystack'
import { notifySubscriptionCancelled } from '@/lib/billing/notify'

export const dynamic = 'force-dynamic'

type Row = { plan: 'monthly_auto' | 'monthly_manual' | 'lifetime'; status: 'active' | 'past_due' | 'cancelled' | 'expired'; current_period_end: string | null; cancel_at_period_end: boolean; paystack_subscription_code: string | null; paystack_email_token: string | null }

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const nowIso = () => new Date().toISOString()

/** Stops automatic renewal. Access is untouched: the paid period still runs. */
export async function POST() {
  try {
    await assertSameOrigin()
  } catch {
    return json({ error: 'That request did not come from PastQ.' }, 403)
  }

  let userId: string
  try {
    userId = (await requireUser()).user.id
  } catch {
    return json({ error: 'Sign in again to continue.' }, 401)
  }

  const rows = await db<Row[]>('entitlements', {}, `?select=plan,status,current_period_end,cancel_at_period_end,paystack_subscription_code,paystack_email_token&user_id=eq.${encodeURIComponent(userId)}&limit=1`).catch(() => [] as Row[])
  const row = rows?.[0] ?? null

  if (!row) return json({ error: 'There is no monthly plan on this account.' }, 409)
  if (row.plan === 'lifetime') return json({ error: 'Lifetime access never renews, so there is nothing to cancel.' }, 409)
  if (row.plan !== 'monthly_auto') return json({ error: 'Your plan does not renew automatically, so there is nothing to cancel.' }, 409)
  if (row.cancel_at_period_end) return json({ ok: true, alreadyCancelled: true })

  // Paystack first: if it cannot stop the charge, say so rather than pretend.
  if (row.paystack_subscription_code && row.paystack_email_token) {
    const outcome = await disableSubscription(row.paystack_subscription_code, row.paystack_email_token)
    if (outcome === 'error') return json({ error: 'Paystack could not be reached. Please try again in a moment.' }, 502)
  }

  const flipped = await db<Array<{ user_id: string }>>('entitlements', {
    method: 'PATCH',
    body: JSON.stringify({ cancel_at_period_end: true, updated_at: nowIso() }),
  }, `?user_id=eq.${encodeURIComponent(userId)}&cancel_at_period_end=eq.false`).catch(() => null)

  // Only the request that actually flipped the flag sends the note, so a double
  // click cannot post two emails.
  if (Array.isArray(flipped) && flipped.length === 1) await notifySubscriptionCancelled(userId)

  return json({ ok: true })
}
