import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CheckCircle2, Clock3, ShieldAlert } from 'lucide-react'
import { PaymentPending } from '@/components/billing/payment-pending'
import { db } from '@/lib/auth/db'
import { getCurrentUser } from '@/lib/auth/session'
import { applySuccessfulCharge } from '@/lib/billing/apply'
import { formatNaira } from '@/lib/billing/pricing'
import { getEntitlementSummary, PLAN_LABELS, type EntitlementSummary } from '@/lib/entitlements'
import './callback.css'

export const metadata: Metadata = { title: 'Payment', robots: { index: false, follow: false } }

type PaymentRow = { id: string; reference: string; plan: 'monthly_auto' | 'monthly_manual' | 'lifetime'; amount_kobo: number; status: string }

// This page sits outside the app shell, so it applies the theme cookie before
// the first paint instead of flashing the wrong palette.
const THEME_SCRIPT =
  "try{var m=document.cookie.match(/(?:^|; )pastq_theme=(dark|light)/);var d=m?m[1]==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}"

const shell = (children: React.ReactNode) => (
  <main className="pay-shell">
    <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
    <div className="pay-frame">
      <Link href="/" className="pay-brand" aria-label="PastQ home">
        <img src="/brand/pastq-wordmark.svg" alt="PastQ" />
      </Link>
      {children}
    </div>
  </main>
)

function nextLine(summary: EntitlementSummary, plan: PaymentRow['plan']): string {
  if (plan === 'lifetime') return 'Lifetime access is open. Nothing renews and there is nothing else to pay.'
  if (plan === 'monthly_auto') {
    return summary.periodLabel && summary.periodLabel.startsWith('Renews')
      ? `Your plan renews automatically. ${summary.periodLabel}, and you can stop it any time from your subscription.`
      : 'Your plan renews automatically. You can stop it any time from your subscription.'
  }
  return summary.periodLabel ? `${summary.periodLabel}. Pay for another month whenever you are ready.` : 'This month is open. Pay for another month whenever you are ready.'
}

export default async function PaymentCallbackPage({ searchParams }: { searchParams: Promise<{ reference?: string; trxref?: string }> }) {
  const params = await searchParams
  const reference = (params.reference ?? params.trxref ?? '').trim().slice(0, 120)
  const returnPath = `/payments/callback${reference ? `?reference=${encodeURIComponent(reference)}` : ''}`

  const signedIn = await getCurrentUser()
  if (!signedIn) redirect(`/sign-in?next=${encodeURIComponent(returnPath)}`)

  if (!reference) {
    return shell(
      <section className="pay-card">
        <span className="pay-mark pay-mark-warn" aria-hidden="true"><ShieldAlert size={22} /></span>
        <h1 className="pay-title">We could not find that payment</h1>
        <p className="pay-lede">The link is missing its payment reference. If you were charged, your plan still activates and the receipt reaches your inbox.</p>
        <div className="pay-actions">
          <Link className="pay-button" href="/plans">See plans</Link>
          <Link className="pay-button pay-button-quiet" href="/app">Back to PastQ</Link>
        </div>
      </section>,
    )
  }

  const rows = await db<PaymentRow[]>('payments', {}, `?select=id,reference,plan,amount_kobo,status&reference=eq.${encodeURIComponent(reference)}&user_id=eq.${encodeURIComponent(signedIn.user.id)}&limit=1`).catch(() => [] as PaymentRow[])
  const payment = rows?.[0] ?? null

  if (!payment) {
    return shell(
      <section className="pay-card">
        <span className="pay-mark pay-mark-warn" aria-hidden="true"><ShieldAlert size={22} /></span>
        <h1 className="pay-title">We could not find that payment</h1>
        <p className="pay-lede">Nothing under this reference belongs to your account. If you were charged, contact support from Help and we will trace it.</p>
        <div className="pay-actions">
          <Link className="pay-button" href="/plans">See plans</Link>
          <Link className="pay-button pay-button-quiet" href="/app">Back to PastQ</Link>
        </div>
      </section>,
    )
  }

  // A query string is only a hint: the server asks Paystack what really happened.
  // A payment already marked successful is trusted, unless access never landed.
  const settled = payment.status === 'success' && signedIn.user.premium
  const confirmed = settled ? { outcome: 'success' as const } : await applySuccessfulCharge(reference, 'callback')

  if (confirmed.outcome === 'pending') {
    return shell(<PaymentPending reference={payment.reference} />)
  }

  if (confirmed.outcome === 'failed') {
    return shell(
      <section className="pay-card">
        <span className="pay-mark pay-mark-warn" aria-hidden="true"><ShieldAlert size={22} /></span>
        <h1 className="pay-title">Payment didn&rsquo;t go through</h1>
        <p className="pay-lede">Paystack did not confirm this payment, so nothing has been opened on your account.</p>
        <div className="pay-actions">
          <Link className="pay-button" href="/plans">Try again</Link>
          <Link className="pay-button pay-button-quiet" href="/app">Back to PastQ</Link>
        </div>
        <p className="pay-note">Your reference is <span className="pay-ref">{payment.reference.toUpperCase()}</span>.</p>
      </section>,
    )
  }

  const fresh = (await getCurrentUser())?.user ?? signedIn.user
  const summary = getEntitlementSummary(fresh)
  const plan = payment.plan

  return shell(
    <section className="pay-card">
      <span className="pay-mark" aria-hidden="true"><CheckCircle2 size={22} /></span>
      <h1 className="pay-title">You&rsquo;re premium</h1>
      <p className="pay-lede">Every year of every exam is open to you now, in practice and in CBT.</p>

      <dl className="pay-facts">
        <div>
          <dt>Plan</dt>
          <dd>{PLAN_LABELS[plan] ?? 'PastQ premium'}</dd>
        </div>
        <div>
          <dt>Paid</dt>
          <dd>{formatNaira(payment.amount_kobo)}</dd>
        </div>
        <div>
          <dt>Next</dt>
          <dd>{nextLine(summary, plan)}</dd>
        </div>
      </dl>

      <div className="pay-actions">
        <Link className="pay-button" href="/app">Start practising</Link>
        {plan !== 'lifetime' && <Link className="pay-button pay-button-quiet" href="/profile/subscription">Manage subscription</Link>}
      </div>

      <p className="pay-note">
        <Clock3 size={13} aria-hidden="true" /> Receipt sent to your email. Reference <span className="pay-ref">{payment.reference.toUpperCase()}</span>.
      </p>
    </section>,
  )
}
