import 'server-only'
import { db } from '@/lib/auth/db'
import { stamp } from '@/lib/dates'
import { PLAN_LABELS } from '@/lib/entitlements'
import { sendEmail } from '@/lib/email/send'
import { env } from '@/lib/env'
import { formatNaira } from './pricing'
import { disableSubscription, PaystackError, verifyTransaction, type VerifiedTransaction } from './paystack'

/** Everything that turns a Paystack charge into access. One function serves the
 *  browser callback and the webhook, so both follow exactly the same rules. */

export type PaymentPlan = 'monthly_auto' | 'monthly_manual' | 'lifetime'
export type ApplySource = 'callback' | 'webhook' | 'renewal'
export type ApplyOutcome = 'success' | 'pending' | 'failed'
export type ApplyResult = { outcome: ApplyOutcome; plan: PaymentPlan | null; reference: string; granted: boolean }

type PaymentRow = { id: string; user_id: string; reference: string; plan: PaymentPlan; amount_kobo: number; currency: string; status: 'pending' | 'success' | 'failed' | 'abandoned'; channel: string | null; paystack_transaction_id: number | string | null; paid_at: string | null; created_at: string }
type EntitlementRow = { user_id: string; plan: PaymentPlan; status: 'active' | 'past_due' | 'cancelled' | 'expired'; current_period_end: string | null; cancel_at_period_end: boolean; paystack_customer_code: string | null; paystack_subscription_code: string | null; paystack_email_token: string | null; started_at: string | null }
type UserRow = { id: string; email: string; name: string | null }

const PAYMENT_COLUMNS = 'id,user_id,reference,plan,amount_kobo,currency,status,channel,paystack_transaction_id,paid_at,created_at'
const ENTITLEMENT_COLUMNS = 'user_id,plan,status,current_period_end,cancel_at_period_end,paystack_customer_code,paystack_subscription_code,paystack_email_token,started_at'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const nowIso = () => new Date().toISOString()
const appUrl = () => (env.APP_URL || 'https://pastq.app').replace(/\/+$/, '')
const asUuid = (value: unknown) => (typeof value === 'string' && UUID.test(value.trim()) ? value.trim() : null)
const asString = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)
const asPlan = (value: unknown): PaymentPlan | null => (value === 'monthly_auto' || value === 'monthly_manual' || value === 'lifetime' ? value : null)

/** One calendar month later, clamped so 31 Jan becomes 28/29 Feb rather than March. */
export function addOneMonth(from: Date): Date {
  const target = new Date(from.getTime())
  const day = target.getUTCDate()
  target.setUTCDate(1)
  target.setUTCMonth(target.getUTCMonth() + 1)
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target
}

const parseDate = (value: string | null | undefined) => {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}
/** The point a new paid month starts from: now, or the unused remainder. */
const periodStart = (end: string | null | undefined, now: number) => {
  const until = parseDate(end)
  return until && until > now ? new Date(until) : new Date(now)
}

async function findPayment(reference: string) {
  const rows = await db<PaymentRow[]>('payments', {}, `?select=${PAYMENT_COLUMNS}&reference=eq.${encodeURIComponent(reference)}&limit=1`)
  return rows?.[0] ?? null
}

async function findEntitlement(userId: string) {
  const rows = await db<EntitlementRow[]>('entitlements', {}, `?select=${ENTITLEMENT_COLUMNS}&user_id=eq.${encodeURIComponent(userId)}&limit=1`)
  return rows?.[0] ?? null
}

async function findUser(userId: string) {
  const rows = await db<UserRow[]>('users', {}, `?select=id,email,name&id=eq.${encodeURIComponent(userId)}&limit=1`)
  return rows?.[0] ?? null
}

async function saveEntitlement(userId: string, patch: Partial<EntitlementRow> & { updated_at?: string }) {
  const body = { updated_at: nowIso(), ...patch }
  const existing = await findEntitlement(userId)
  if (existing) {
    const updated = await db<EntitlementRow[]>('entitlements', { method: 'PATCH', body: JSON.stringify(body) }, `?user_id=eq.${encodeURIComponent(userId)}`)
    if (updated?.[0]) return updated[0]
  }
  // First write for this user, or a create that raced another webhook.
  const inserted = await db<EntitlementRow[]>('entitlements', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ user_id: userId, ...body }),
  }, '?on_conflict=user_id').catch(() => null)
  return inserted?.[0] ?? null
}

/**
 * Claims an event key so each Paystack event is handled once. 'duplicate' when
 * the row already exists, 'error' when the table itself could not be reached
 * (the caller decides whether that deserves a retry).
 */
export async function claimPaymentEvent(eventKey: string, eventType: string, reference: string | null): Promise<'new' | 'duplicate' | 'error'> {
  try {
    const rows = await db<Array<{ id: string }>>('payment_events', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify({ event_key: eventKey.slice(0, 200), event_type: eventType.slice(0, 80), reference, received_at: nowIso() }),
    }, '?on_conflict=event_key')
    return Array.isArray(rows) && rows.length > 0 ? 'new' : 'duplicate'
  } catch {
    return 'error'
  }
}

/** Audit row only: a failed write here must not undo a granted payment. */
async function notePaymentEvent(eventKey: string, eventType: string, reference: string | null) {
  await claimPaymentEvent(eventKey, eventType, reference)
}

async function markFailed(paymentId: string, patch: Partial<PaymentRow> = {}) {
  await db('payments', { method: 'PATCH', body: JSON.stringify({ status: 'failed', ...patch }) }, `?id=eq.${encodeURIComponent(paymentId)}&status=eq.pending`).catch(() => undefined)
}

/** Which user a charge belongs to: our own row first, then Paystack metadata,
 *  then a stored subscription, then the email on the transaction. */
async function resolveUserId(input: { payment?: PaymentRow | null; metadata?: Record<string, unknown> | null; customerCode?: string | null; subscriptionCode?: string | null; email?: string | null }) {
  if (input.payment?.user_id) return input.payment.user_id
  const metaUser = asUuid(input.metadata?.user_id)
  if (metaUser) {
    const rows = await db<Array<{ id: string }>>('users', {}, `?select=id&id=eq.${metaUser}&limit=1`).catch(() => [])
    if (rows?.[0]?.id) return metaUser
  }
  if (input.customerCode) {
    const rows = await db<Array<{ user_id: string }>>('entitlements', {}, `?select=user_id&paystack_customer_code=eq.${encodeURIComponent(input.customerCode)}&limit=1`)
    if (rows?.[0]?.user_id) return rows[0].user_id
  }
  if (input.subscriptionCode) {
    const rows = await db<Array<{ user_id: string }>>('entitlements', {}, `?select=user_id&paystack_subscription_code=eq.${encodeURIComponent(input.subscriptionCode)}&limit=1`)
    if (rows?.[0]?.user_id) return rows[0].user_id
  }
  const email = input.email?.trim().toLowerCase()
  if (email) {
    const rows = await db<Array<{ id: string }>>('users', {}, `?select=id&email=eq.${encodeURIComponent(email)}&limit=1`)
    if (rows?.[0]?.id) return rows[0].id
  }
  return null
}

type GrantContext = { plan: PaymentPlan; customerCode: string | null; subscriptionCode?: string | null; emailToken?: string | null; now?: number }

async function grantAccess(userId: string, context: GrantContext) {
  const now = context.now ?? Date.now()
  const existing = await findEntitlement(userId)
  const customerCode = context.customerCode ?? existing?.paystack_customer_code ?? null

  // A leftover subscription must never buy a lifetime holder back down.
  if (existing?.plan === 'lifetime' && existing.status === 'active' && context.plan !== 'lifetime') {
    if (existing.paystack_subscription_code && existing.paystack_email_token) {
      await disableSubscription(existing.paystack_subscription_code, existing.paystack_email_token)
    }
    return
  }

  if (context.plan === 'lifetime') {
    await saveEntitlement(userId, {
      plan: 'lifetime',
      status: 'active',
      current_period_end: null,
      cancel_at_period_end: false,
      paystack_customer_code: customerCode,
      paystack_subscription_code: null,
      paystack_email_token: null,
      started_at: existing?.started_at ?? nowIso(),
    })
    // A lifetime payment ends any monthly subscription still charging them.
    if (existing?.plan === 'monthly_auto' && existing.paystack_subscription_code && existing.paystack_email_token) {
      await disableSubscription(existing.paystack_subscription_code, existing.paystack_email_token)
    }
    return
  }

  const start = periodStart(existing?.current_period_end, now)
  const end = addOneMonth(start)
  await saveEntitlement(userId, {
    plan: context.plan,
    status: 'active',
    current_period_end: end.toISOString(),
    cancel_at_period_end: false,
    paystack_customer_code: customerCode,
    paystack_subscription_code: context.subscriptionCode ?? existing?.paystack_subscription_code ?? null,
    paystack_email_token: context.emailToken ?? existing?.paystack_email_token ?? null,
    started_at: existing?.started_at ?? nowIso(),
  })
}

async function sendReceipt(userId: string, plan: PaymentPlan, amountKobo: number, paidAt: string | null, reference: string) {
  try {
    const user = await findUser(userId)
    if (!user?.email) return
    await sendEmail({
      to: user.email,
      template: 'payment_receipt',
      data: {
        firstName: (user.name || '').trim().split(' ')[0] || 'there',
        planName: PLAN_LABELS[plan],
        amountLabel: formatNaira(amountKobo),
        paidOn: stamp(paidAt ?? nowIso()),
        reference,
        manageUrl: `${appUrl()}/profile/subscription`,
      },
    })
  } catch {
    // A receipt that fails to send must never undo a payment.
  }
}

/**
 * Confirm a charge with Paystack, then make exactly one grant for it.
 * The flip from `pending` to `success` is the lock: whoever wins it grants.
 */
export async function applySuccessfulCharge(reference: string, source: ApplySource = 'callback'): Promise<ApplyResult> {
  const clean = reference.trim().slice(0, 120)
  if (!clean) return { outcome: 'failed', plan: null, reference: '', granted: false }

  const payment = await findPayment(clean)

  let verified: VerifiedTransaction
  try {
    verified = await verifyTransaction(clean)
  } catch (error) {
    const refused = error instanceof PaystackError && error.code === 'rejected'
    if (refused && payment?.status === 'pending') await markFailed(payment.id)
    return { outcome: refused ? 'failed' : 'pending', plan: payment?.plan ?? null, reference: clean, granted: false }
  }

  if (verified.status !== 'success') {
    const failed = verified.status === 'failed' || verified.status === 'reversed' || verified.status === 'abandoned'
    if (failed && payment?.status === 'pending') await markFailed(payment.id)
    return { outcome: failed ? 'failed' : 'pending', plan: payment?.plan ?? null, reference: clean, granted: false }
  }

  // Money must be what we asked for, in the currency we asked for.
  const wrongMoney = verified.currency !== 'NGN' || verified.amountKobo <= 0 || (payment ? verified.amountKobo !== payment.amount_kobo : false)
  if (wrongMoney) {
    if (payment?.status === 'pending') await markFailed(payment.id)
    return { outcome: 'failed', plan: payment?.plan ?? null, reference: clean, granted: false }
  }

  const plan: PaymentPlan = payment?.plan ?? asPlan(verified.metadata?.plan) ?? 'monthly_auto'
  const userId = await resolveUserId({
    payment,
    metadata: verified.metadata,
    customerCode: verified.customerCode,
    subscriptionCode: asString(verified.metadata?.subscription_code),
    email: verified.customerEmail,
  })
  if (!userId) return { outcome: 'pending', plan, reference: clean, granted: false }

  let owned = false
  let recorded: PaymentRow | null = payment

  if (payment) {
    if (payment.status === 'success') {
      // Paystack repeats postbacks. Only heal the case where the earlier grant
      // never wrote a row at all, which cannot extend a period twice.
      const existing = await findEntitlement(userId)
      if (!existing) {
        await grantAccess(userId, { plan, customerCode: verified.customerCode })
        await sendReceipt(userId, plan, payment.amount_kobo, payment.paid_at, clean)
        return { outcome: 'success', plan, reference: clean, granted: true }
      }
      return { outcome: 'success', plan, reference: clean, granted: false }
    }
    const flipped = await db<PaymentRow[]>('payments', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'success', paid_at: verified.paidAt ?? nowIso(), channel: verified.channel, paystack_transaction_id: verified.transactionId === null ? null : String(verified.transactionId) }),
    }, `?id=eq.${encodeURIComponent(payment.id)}&status=eq.pending`)
    owned = Array.isArray(flipped) && flipped.length === 1
  } else {
    // A renewal Paystack charged on a stored subscription: no row of ours yet.
    const inserted = await db<PaymentRow[]>('payments', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        reference: clean,
        plan,
        amount_kobo: verified.amountKobo,
        currency: 'NGN',
        status: 'success',
        channel: verified.channel,
        paystack_transaction_id: verified.transactionId === null ? null : String(verified.transactionId),
        paid_at: verified.paidAt ?? nowIso(),
      }),
    }).catch(() => null)
    owned = Array.isArray(inserted) && inserted.length === 1
    recorded = inserted?.[0] ?? null
    if (!owned) return { outcome: 'success', plan, reference: clean, granted: false }
  }

  if (!owned) return { outcome: 'success', plan, reference: clean, granted: false }

  await notePaymentEvent(`charge.success:${clean}`, source === 'renewal' ? 'renewal.success' : 'charge.success', clean)
  await grantAccess(userId, { plan, customerCode: verified.customerCode })
  await sendReceipt(userId, plan, recorded?.amount_kobo ?? verified.amountKobo, recorded?.paid_at ?? verified.paidAt, clean)
  return { outcome: 'success', plan, reference: clean, granted: true }
}

/** subscription.create: keep the codes, and never shorten a longer paid period. */
export async function linkSubscription(input: { subscriptionCode: string; emailToken: string | null; customerCode: string | null; nextPaymentDate: string | null; metadata?: Record<string, unknown> | null; email?: string | null }): Promise<void> {
  const userId = await resolveUserId({ metadata: input.metadata, customerCode: input.customerCode, subscriptionCode: input.subscriptionCode, email: input.email })
  if (!userId) return
  const existing = await findEntitlement(userId)
  const stored = existing?.current_period_end ?? null
  const storedTime = parseDate(stored)
  const nextTime = parseDate(input.nextPaymentDate)
  // Only ever move the end forward: a late event must not shorten paid time.
  const periodEnd = input.nextPaymentDate && (storedTime === null || (nextTime ?? Number.POSITIVE_INFINITY) > storedTime) ? input.nextPaymentDate : stored

  if (!existing) {
    // subscription.create can arrive before the first charge is applied. The
    // period comes from Paystack itself, so access is still only ever paid-for.
    await saveEntitlement(userId, {
      plan: 'monthly_auto',
      status: 'active',
      current_period_end: periodEnd ?? null,
      cancel_at_period_end: false,
      paystack_customer_code: input.customerCode,
      paystack_subscription_code: input.subscriptionCode,
      paystack_email_token: input.emailToken,
      started_at: nowIso(),
    })
    return
  }

  const keepLifetime = existing.plan === 'lifetime' && existing.status === 'active'
  await saveEntitlement(userId, {
    plan: keepLifetime ? 'lifetime' : 'monthly_auto',
    status: 'active',
    current_period_end: keepLifetime ? null : periodEnd ?? null,
    cancel_at_period_end: keepLifetime ? false : existing.cancel_at_period_end,
    paystack_customer_code: input.customerCode ?? existing.paystack_customer_code,
    paystack_subscription_code: input.subscriptionCode,
    paystack_email_token: input.emailToken,
    started_at: existing.started_at ?? nowIso(),
  })
}

/** The "payment failed" note that goes with a past-due row. Best effort. */
export async function notifyPaymentFailed(userId: string): Promise<void> {
  try {
    const user = await findUser(userId)
    if (!user?.email) return
    await sendEmail({
      to: user.email,
      template: 'payment_failed',
      data: { firstName: (user.name || '').trim().split(' ')[0] || 'there', manageUrl: `${appUrl()}/profile/subscription` },
    })
  } catch {
    // Nothing in billing depends on an email leaving.
  }
}

/** invoice.payment_failed: the row goes past due; the grace period covers access. */
export async function markSubscriptionPastDue(input: { subscriptionCode?: string | null; customerCode?: string | null; email?: string | null }): Promise<{ userId: string | null }> {
  const userId = await resolveUserId({ customerCode: input.customerCode, subscriptionCode: input.subscriptionCode, email: input.email })
  if (!userId) return { userId: null }
  const existing = await findEntitlement(userId)
  if (!existing || existing.plan === 'lifetime') return { userId }
  if (existing.status !== 'active' && existing.status !== 'past_due') return { userId }
  await saveEntitlement(userId, { status: 'past_due', updated_at: nowIso() })
  return { userId }
}

/** subscription.not_renew keeps access to the end; subscription.disable ends it there. */
export async function stopRenewal(input: { subscriptionCode?: string | null; customerCode?: string | null; email?: string | null; disabled: boolean }): Promise<void> {
  const userId = await resolveUserId({ customerCode: input.customerCode, subscriptionCode: input.subscriptionCode, email: input.email })
  if (!userId) return
  const existing = await findEntitlement(userId)
  if (!existing || existing.plan === 'lifetime') return
  const until = parseDate(existing.current_period_end)
  const ended = until === null || until <= Date.now()
  await saveEntitlement(userId, {
    cancel_at_period_end: true,
    status: input.disabled || ended ? (ended ? 'expired' : 'cancelled') : existing.status,
    updated_at: nowIso(),
  })
}
