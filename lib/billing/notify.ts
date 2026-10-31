import 'server-only'
import { db } from '@/lib/auth/db'
import { calendarDate, stamp } from '@/lib/dates'
import { PLAN_LABELS } from '@/lib/entitlements'
import { sendEmail } from '@/lib/email/send'
import { env } from '@/lib/env'
import { formatNaira, getPricing } from './pricing'

/** Every billing email, in one place, and never allowed to fail the work that
 *  caused it. Copy lives in lib/email/templates. */

type BillingPlan = 'monthly_auto' | 'monthly_manual' | 'lifetime'
type BillingUser = { id: string; email: string; name: string | null }
type BillingRow = { plan: BillingPlan; status: 'active' | 'past_due' | 'cancelled' | 'expired'; current_period_end: string | null; cancel_at_period_end: boolean }

const appUrl = () => (env.APP_URL || 'https://pastq.app').replace(/\/+$/, '')
const planName = (plan: BillingPlan | null | undefined) => (plan ? PLAN_LABELS[plan] : 'PastQ premium')

async function loadUser(userId: string): Promise<BillingUser | null> {
  try {
    const rows = await db<BillingUser[]>('users', {}, `?select=id,email,name&id=eq.${encodeURIComponent(userId)}&limit=1`)
    return rows?.[0] ?? null
  } catch {
    return null
  }
}

async function loadBilling(userId: string): Promise<BillingRow | null> {
  try {
    const rows = await db<BillingRow[]>('entitlements', {}, `?select=plan,status,current_period_end,cancel_at_period_end&user_id=eq.${encodeURIComponent(userId)}&limit=1`)
    return rows?.[0] ?? null
  } catch {
    return null
  }
}

const firstName = (user: BillingUser) => (user.name || '').trim().split(' ')[0] || 'there'
const dateLabel = (value: string | null | undefined) => (value && !Number.isNaN(Date.parse(value)) ? calendarDate(value) : 'the end of your period')

async function deliver(userId: string, build: (user: BillingUser) => Promise<void> | void) {
  try {
    const user = await loadUser(userId)
    if (!user?.email) return
    await build(user)
  } catch {
    // Billing must never depend on an email leaving.
  }
}

/** The receipt for one charge. Called on grant and from the history list. */
export async function sendReceiptEmail(userId: string, input: { plan: BillingPlan; amountKobo: number; paidAt?: string | null; reference: string }) {
  await deliver(userId, async (user) => {
    await sendEmail({
      to: user.email,
      template: 'payment_receipt',
      data: {
        firstName: firstName(user),
        planName: planName(input.plan),
        amountLabel: formatNaira(input.amountKobo),
        paidOn: stamp(input.paidAt ?? new Date().toISOString()),
        reference: input.reference,
        manageUrl: `${appUrl()}/profile/subscription`,
      },
    })
  })
}

export async function notifyPaymentFailed(userId: string) {
  await deliver(userId, async (user) => {
    await sendEmail({ to: user.email, template: 'payment_failed', data: { firstName: firstName(user), manageUrl: `${appUrl()}/profile/subscription` } })
  })
}

/** Sent when a customer stops automatic renewal, not when access ends. */
export async function notifySubscriptionCancelled(userId: string) {
  await deliver(userId, async (user) => {
    const billing = await loadBilling(userId)
    await sendEmail({
      to: user.email,
      template: 'subscription_cancelled',
      data: {
        firstName: firstName(user),
        planName: planName(billing?.plan),
        endsOn: dateLabel(billing?.current_period_end),
        subscriptionUrl: `${appUrl()}/profile/subscription`,
        plansUrl: `${appUrl()}/plans`,
      },
    })
  })
}

export async function notifyAccessEnded(userId: string, endedOn?: string | null) {
  await deliver(userId, async (user) => {
    const billing = await loadBilling(userId)
    await sendEmail({
      to: user.email,
      template: 'access_ended',
      data: {
        firstName: firstName(user),
        planName: planName(billing?.plan),
        endedOn: dateLabel(endedOn ?? billing?.current_period_end),
        plansUrl: `${appUrl()}/plans`,
      },
    })
  })
}

/** '3d' three days out, '0d' on the last day. Manual and cancelled plans only. */
export async function notifyRenewalReminder(userId: string, kind: '3d' | '0d', amountLabel?: string) {
  const label = amountLabel ?? formatNaira((await getPricing().catch(() => null))?.monthlyKobo ?? 0)
  await deliver(userId, async (user) => {
    const billing = await loadBilling(userId)
    await sendEmail({
      to: user.email,
      template: 'renewal_reminder',
      data: {
        firstName: firstName(user),
        planName: planName(billing?.plan),
        endsOn: dateLabel(billing?.current_period_end),
        amountLabel: label,
        lastDay: kind === '0d',
        plansUrl: `${appUrl()}/plans`,
      },
    })
  })
}
