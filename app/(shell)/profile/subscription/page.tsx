import Link from 'next/link'
import { PageHeader, ProfileLayout } from '@/components/profile-hub'
import { db } from '@/lib/auth/db'
import { requireUser } from '@/lib/auth/session'
import { calendarDate } from '@/lib/dates'
import { formatNaira } from '@/lib/billing/pricing'
import { getEntitlementSummary, planLabel, shortPlanLabel, type EntitlementSummary } from '@/lib/entitlements'
import './subscription.css'

type PaymentStatus = 'pending' | 'success' | 'failed' | 'abandoned'
type PaymentRow = { id: string; reference: string; plan: string; amount_kobo: number; currency: string; status: PaymentStatus; paid_at: string | null; created_at: string }

const PAYMENT_COLUMNS = 'id,reference,plan,amount_kobo,currency,status,paid_at,created_at'
const STATUS_COPY: Record<PaymentStatus, string> = { pending: 'Pending', success: 'Paid', failed: 'Failed', abandoned: 'Abandoned' }

/** History is a nicety: a failed read shows the empty state, never an error page. */
async function loadPayments(userId: string): Promise<PaymentRow[]> {
  try {
    return (await db<PaymentRow[]>('payments', {}, `?select=${PAYMENT_COLUMNS}&user_id=eq.${userId}&order=created_at.desc&limit=12`)) ?? []
  } catch {
    return []
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

function PremiumPlan({ summary }: { summary: EntitlementSummary }) {
  return <div className="plan-card sub-plan">
    <div className="sub-head">
      <h2>{summary.planLabel}</h2>
      <span className={`sub-state sub-state-${summary.status ?? 'active'}`}>{summary.statusLabel}</span>
    </div>
    {summary.periodLabel && <p className="sub-term">{summary.periodLabel}</p>}
    <ul className="plan-list"><li>Every year of every exam</li><li>Practice and CBT across the full bank</li><li>Progress and history kept as before</li></ul>
  </div>
}

export default async function SubscriptionPage() {
  const { user } = await requireUser()
  const summary = getEntitlementSummary(user)
  const payments = await loadPayments(user.id)

  return (
    <ProfileLayout>
      <PageHeader title="Subscription" description="Choose how you want to prepare." />
      {summary.premium ? <PremiumPlan summary={summary} /> : <FreePlan />}
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </ProfileLayout>
  )
}
