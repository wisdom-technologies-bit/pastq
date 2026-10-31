import type { PastQEntitlement, PastQUser } from './auth/session'
import { calendarDate } from './dates'
import { env } from './env'

export type Tier = 'free' | 'premium'

export type EntitlementSummary = {
  tier: Tier
  premium: boolean
  plan: PastQEntitlement['plan'] | null
  planLabel: string
  status: PastQEntitlement['status'] | null
  statusLabel: string
  /** ISO timestamp the paid period runs to, null for lifetime and free. */
  endsAt: string | null
  /** ISO timestamp of the next automatic renewal, when one is scheduled. */
  renewsAt: string | null
  /** Ready-made line for the UI: "Renews on 12 Nov 2026", "Ends on 12 Nov 2026", "Never expires". */
  periodLabel: string | null
  lifetime: boolean
  cancelAtPeriodEnd: boolean
  startedAt: string | null
}

const DAY = 86_400_000
/** A failed renewal keeps access for three days while Paystack retries. */
const GRACE_MS = 3 * DAY

export const PLAN_LABELS: Record<PastQEntitlement['plan'], string> = {
  monthly_auto: 'Monthly, renews automatically',
  monthly_manual: 'Monthly, manual',
  lifetime: 'Lifetime',
}

export const STATUS_LABELS: Record<PastQEntitlement['status'], string> = {
  active: 'Active',
  past_due: 'Payment due',
  cancelled: 'Cancelled',
  expired: 'Expired',
}

const SHORT_PLAN_LABELS: Record<PastQEntitlement['plan'], string> = { monthly_auto: 'Monthly', monthly_manual: 'Monthly', lifetime: 'Lifetime' }

export function planLabel(plan: string | null | undefined): string {
  return plan && plan in PLAN_LABELS ? PLAN_LABELS[plan as PastQEntitlement['plan']] : 'PastQ premium'
}

/** One-word name for compact rows such as payment history. */
export function shortPlanLabel(plan: string | null | undefined): string {
  return plan && plan in SHORT_PLAN_LABELS ? SHORT_PLAN_LABELS[plan as PastQEntitlement['plan']] : 'Premium'
}

/** Comma separated allowlist that grants premium without any billing row. */
export function isOverrideEmail(email?: string | null): boolean {
  const raw = env.PREMIUM_OVERRIDE_EMAILS
  if (!raw || !email) return false
  const target = email.trim().toLowerCase()
  if (!target) return false
  return raw.split(',').some((entry) => entry.trim().toLowerCase() === target)
}

/**
 * The single source of truth for "is this person premium right now".
 * Lifetime while active, an active period that has not lapsed, a cancelled
 * plan that is paid up to its end date, and a three-day grace after a failed
 * renewal all count. Everything else is free.
 */
export function isPremium(entitlement: PastQEntitlement | null | undefined, email?: string | null, now: number = Date.now()): boolean {
  if (isOverrideEmail(email)) return true
  if (!entitlement) return false

  const end = entitlement.current_period_end ? Date.parse(entitlement.current_period_end) : Number.NaN
  const paidUntil = Number.isFinite(end) ? end : null

  if (entitlement.plan === 'lifetime') return entitlement.status === 'active'
  if (paidUntil === null) return false
  if (entitlement.status === 'active') return paidUntil > now
  if (entitlement.status === 'cancelled') return paidUntil > now
  if (entitlement.status === 'past_due') return now <= paidUntil + GRACE_MS
  return false
}

/** Synchronous by design: the session loader attaches `premium` to the user. */
export function getTier(user?: PastQUser): Tier {
  if (!user) return 'free'
  if (isOverrideEmail(user.email)) return 'premium'
  if (typeof user.premium === 'boolean') return user.premium ? 'premium' : 'free'
  return isPremium(user.entitlement, user.email) ? 'premium' : 'free'
}

/** The year grid marks a year locked only when the Bank says premium and the
 *  viewer has not paid for it. */
export function yearLocked(access: 'free' | 'premium' | null | undefined, tier: Tier): boolean {
  return access !== 'free' && tier !== 'premium'
}

const period = (value: string | null | undefined) => (value ? calendarDate(value) : '')
const validIso = (value: string | null | undefined) => (value && !Number.isNaN(Date.parse(value)) ? value : null)

/** Plain, serialisable description of a user's access for the UI. */
export function getEntitlementSummary(user?: PastQUser, now: number = Date.now()): EntitlementSummary {
  const tier = getTier(user)
  const premium = tier === 'premium'
  const entitlement = user?.entitlement ?? null

  if (!entitlement) {
    return {
      tier,
      premium,
      plan: null,
      planLabel: premium ? 'Premium access' : 'Free plan',
      status: premium ? 'active' : null,
      statusLabel: premium ? STATUS_LABELS.active : '',
      endsAt: null,
      renewsAt: null,
      periodLabel: premium ? 'Premium access' : null,
      lifetime: false,
      cancelAtPeriodEnd: false,
      startedAt: null,
    }
  }

  const lifetime = entitlement.plan === 'lifetime'
  const endsAt = lifetime ? null : validIso(entitlement.current_period_end)
  const renewsAt = entitlement.plan === 'monthly_auto' && entitlement.status === 'active' && !entitlement.cancel_at_period_end ? endsAt : null
  const periodLabel = lifetime
    ? 'Never expires'
    : renewsAt
      ? `Renews on ${period(renewsAt)}`
      : endsAt
        ? `Ends on ${period(endsAt)}`
        : premium
          ? 'Premium access'
          : null

  return {
    tier,
    premium,
    plan: entitlement.plan,
    planLabel: PLAN_LABELS[entitlement.plan],
    status: entitlement.status,
    statusLabel: STATUS_LABELS[entitlement.status],
    endsAt,
    renewsAt,
    periodLabel,
    lifetime,
    cancelAtPeriodEnd: Boolean(entitlement.cancel_at_period_end),
    startedAt: validIso(entitlement.started_at),
  }
}
