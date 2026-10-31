import Link from 'next/link'
import { PageHeader, ProfileLayout } from '@/components/profile-hub'
import { ReceiptButton } from '@/components/billing/receipt-button'
import { SubscriptionActions } from '@/components/billing/subscription-actions'
import { UpdateCardButton } from '@/components/billing/update-card-button'
import { db } from '@/lib/auth/db'
import { requireUser } from '@/lib/auth/session'
import { calendarDate } from '@/lib/dates'
import { formatNaira, getPricing } from '@/lib/billing/pricing'
import { getEntitlementSummary, planLabel, shortPlanLabel } from '@/lib/entitlements'
import './subscription.css'

type PaymentStatus = 'pending' | 'success' | 'failed' | 'abandoned'
type PaymentRow = { id: string; reference: string; plan: string; amount_kobo: number; currency: string; status: PaymentStatus; paid_at: string | null; created_at: string }

const PAYMENT_COLUMNS = 'id,reference,plan,amount_kobo,currency,status,paid_at,created_at'
const STATUS_COPY: Record<PaymentStatus, string> = { pending: 'Pending', success: 'Paid', failed: 'Failed', abandoned: 'Abandoned' }
const DAY = 86_400_000

/** History is a nicety: a failed read shows the empty state, never an error page. */
async function loadPayments(userId: string): Promise<PaymentRow[]> {
  try {
    return (await db<PaymentRow[]>('payments', {}, `?select=${PAYMENT_COLUMNS}&user_id=eq.${userId}&order=created_at.desc&limit=12`)) ?? []
  } catch {
    return []
  }
}

/** Only a live subscription has a card Paystack can open. The code itself never
 *  leaves the server: the button asks the API for a link on click. */
async function hasSubscription(userId: string): Promise<boolean> {
  try {
    const rows = await db<Array<{ paystack_subscription_code: string | null }>>('entitlements', {}, `?select=paystack_subscription_code&user_id=eq.${userId}&limit=1`)
    return Boolean(rows?.[0]?.paystack_subscription_code)
  } catch {
    return false
  }
}

const shortReference = (reference: string) => (reference.length > 8 ? reference.slice(-8) : reference).toUpperCase()

function FreePlan() {
  return <div className="plan-card sub-plan">
    <span className="status-chip">Free plan</span>
    <h2>Keep building your confidence</h2>
    <p>Practice the latest two years of each exam for free.</p>
    <ul className="plan-list free-list"><li>Latest two years of every exam</li><li>Practice mode and progress tracking</li><li>CBT sessions to test yourself</li></ul>
    <div className="locked-list"><p className="muted-copy">Premium adds:</p><ul><li>Every year of every exam</li><li>Borrowing a missing compulsory subject in CBT</li></ul></div>
    <Link className="primary-button premium-action" href="/plans">Activate premium</Link>
  </div>
}

export default async function SubscriptionPage() {
  const { user } = await requireUser()
  const summary = getEntitlementSummary(user)
  const [payments, pricing, subscribed] = await Promise.all([loadPayments(user.id), getPricing(), hasSubscription(user.id)])

  const pastDue = summary.status === 'past_due'
  // The grace window is the same three days the entitlement rules allow.
  const graceEndsOn = summary.endsAt ? calendarDate(new Date(Date.parse(summary.endsAt) + 3 * DAY)) : null

  return (
    <ProfileLayout>
      <PageHeader title="Subscription" description="How your premium access runs, and what it has cost." />
      {summary.premium ? (
        <div className="plan-card sub-plan">
          <div className="sub-head">
            <h2>{summary.planLabel}</h2>
            <span className={`sub-state sub-state-${summary.status ?? 'active'}`}>{summary.statusLabel}</span>
          </div>

          {pastDue && (
            <div className="sub-alert" role="status">
              <div>
                <strong>Your last renewal payment didn&rsquo;t go through</strong>
                <p>
                  Your access continues while we try again{graceEndsOn ? `, until ${graceEndsOn}` : ''}. Updating the card is the quickest fix.
                </p>
              </div>
              <UpdateCardButton className="sub-button sub-button-small" />
            </div>
          )}

          <SubscriptionActions
            plan={summary.plan}
            status={summary.status}
            premium={summary.premium}
            endsOn={summary.endsAt ? calendarDate(summary.endsAt) : null}
            renewAmount={formatNaira(pricing.monthlyKobo)}
            cancelAtPeriodEnd={summary.cancelAtPeriodEnd}
            hasSubscription={subscribed}
          />
        </div>
      ) : (
        <FreePlan />
      )}

      <section className="sub-history" aria-labelledby="sub-history-title">
        <h2 id="sub-history-title">Payment history</h2>
        {payments.length === 0 ? (
          <p className="sub-empty">No payments yet.</p>
        ) : (
          <ul className="sub-payments">
            {payments.map((payment) => (
              <li key={payment.id} className="sub-payment">
                <span className="sub-pay-date">{calendarDate(payment.paid_at ?? payment.created_at)}</span>
                <span className="sub-pay-plan">{shortPlanLabel(payment.plan)}</span>
                <span className={`sub-pay-status sub-pay-${payment.status}`}>{STATUS_COPY[payment.status] ?? payment.status}</span>
                <span className="sub-pay-amount">{formatNaira(payment.amount_kobo)}</span>
                <span className="sub-pay-ref" title={planLabel(payment.plan)}>{shortReference(payment.reference)}</span>
                {payment.status === 'success'
                  ? <ReceiptButton reference={payment.reference} />
                  : <span className="sub-receipt-cell" aria-hidden="true" />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </ProfileLayout>
  )
}
