'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, Check, Loader2, Lock, ShieldCheck } from 'lucide-react'
import './plans.css'

type Plan = 'monthly_auto' | 'monthly_manual' | 'lifetime'

export type PlansViewProps = {
  signedIn: boolean
  premium: boolean
  testMode: boolean
  monthlyPrice: string
  lifetimePrice: string
  next: string | null
  planLabel: string
  plan: Plan | null
  statusLabel: string
  periodLabel: string | null
  cancelAtPeriodEnd: boolean
  /** Shown above the cards when premium is running out and can be renewed. */
  resume?: React.ReactNode
  /** Slot for the plans banner, rendered straight after the hero. */
  children?: React.ReactNode
}

const UNLOCKS = [
  'All years of every exam, in practice and in CBT',
  'Borrow a missing compulsory subject in CBT',
  'The full question bank as it keeps growing',
  'Your progress and history, exactly as they are now',
]

const FAQ = [
  {
    question: 'What happens when my plan ends?',
    answer:
      'Your access runs to the last day you paid for. After that the account drops back to free, and the latest two years of each exam stay open. Nothing in your history is lost.',
  },
  {
    question: 'How do I cancel?',
    answer:
      'Open Subscription from your profile and stop the renewal there. You keep premium until the period you already paid for ends, and you are not charged again.',
  },
  {
    question: 'Is lifetime really forever?',
    answer:
      'For as long as PastQ runs, yes. You pay once and there are no further charges, no renewals and nothing to remember.',
  },
  {
    question: 'Can I get a refund?',
    answer:
      'Contact support from Help and we will look at your situation. We do not promise automatic refunds, so it is worth asking before you pay rather than after.',
  },
]

export function PlansView(props: PlansViewProps) {
  const [mode, setMode] = useState<'monthly_auto' | 'monthly_manual'>('monthly_auto')
  const [busy, setBusy] = useState<Plan | null>(null)
  const [error, setError] = useState('')

  async function checkout(plan: Plan) {
    if (busy) return
    setBusy(plan)
    setError('')
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(props.next ? { plan, next: props.next } : { plan }),
      })
      const body = (await response.json().catch(() => null)) as { url?: string; error?: string } | null
      const url = typeof body?.url === 'string' ? body.url : ''
      if (!response.ok || !url.startsWith('https://')) {
        setError(body?.error || 'We could not start the payment. Please try again in a moment.')
        setBusy(null)
        return
      }
      window.location.href = url
    } catch {
      setError('We could not reach PastQ. Check your connection and try again.')
      setBusy(null)
    }
  }

  const monthlyCta = props.signedIn ? (
    <button type="button" className="pl-cta" onClick={() => checkout(mode)} disabled={Boolean(busy)}>
      {busy === mode ? <><Loader2 size={17} className="pl-spin" aria-hidden="true" /> Opening checkout…</> : <>Continue with monthly <ArrowRight size={16} aria-hidden="true" /></>}
    </button>
  ) : (
    <Link className="pl-cta" href="/sign-in?next=/plans">Sign in to continue</Link>
  )

  const lifetimeCta = props.signedIn ? (
    <button type="button" className="pl-cta" onClick={() => checkout('lifetime')} disabled={Boolean(busy)}>
      {busy === 'lifetime' ? <><Loader2 size={17} className="pl-spin" aria-hidden="true" /> Opening checkout…</> : <>Get lifetime access <ArrowRight size={16} aria-hidden="true" /></>}
    </button>
  ) : (
    <Link className="pl-cta" href="/sign-in?next=/plans">Sign in to continue</Link>
  )

  return (
    <main className="pl-page">
      <div className="pl-inner">
        <header className="pl-topbar">
          <Link href="/" className="pl-brand" aria-label="PastQ home">
            <img src="/brand/pastq-wordmark.svg" alt="PastQ" />
          </Link>
          {props.signedIn ? (
            <Link href="/app" className="pl-topbar-link">Back to PastQ</Link>
          ) : (
            <Link href="/sign-in?next=/plans" className="pl-topbar-link">Sign in</Link>
          )}
        </header>
      </div>

      <div className="pl-inner">
        <section className="pl-hero">
          <p className="pl-kicker">PastQ premium</p>
          <h1>Every year. Every exam.</h1>
          <p className="pl-sub">Open the whole bank: every year PastQ holds, in practice and in CBT, for as long as your plan runs.</p>
          {props.testMode && <span className="pl-testmode">Test mode</span>}
        </section>

        {props.children}

        {props.premium ? (
          <>
            <section className="pl-current" aria-labelledby="pl-current-title">
              <p className="pl-kicker">Your plan</p>
              <h2 id="pl-current-title">{props.planLabel}</h2>
              <p className="pl-current-meta">
                <span className="pl-chip">{props.statusLabel}</span>
                {props.periodLabel && <> <span className="pl-current-date">{props.periodLabel}</span></>}
              </p>
              {props.cancelAtPeriodEnd && <p className="pl-current-note">You keep premium until the end of the period you paid for.</p>}
              <Link href="/profile/subscription" className="pl-secondary">Manage subscription</Link>
            </section>

            {(props.plan === 'monthly_auto' || props.plan === 'monthly_manual') && (
              <aside className="pl-switch">
                <div>
                  <strong>Switch to lifetime</strong>
                  <p>One payment of {props.lifetimePrice} and the monthly charge stops.</p>
                </div>
                <button type="button" className="pl-secondary" onClick={() => checkout('lifetime')} disabled={Boolean(busy)}>
                  {busy === 'lifetime' ? <><Loader2 size={16} className="pl-spin" aria-hidden="true" /> Opening checkout…</> : 'Switch to lifetime'}
                </button>
              </aside>
            )}
          </>
        ) : (
          <>
          {props.resume}
          <div className="pl-prices">
            <article className="pl-card" aria-labelledby="pl-monthly-title">
              <h2 id="pl-monthly-title">Monthly</h2>
              <p className="pl-price"><span>{props.monthlyPrice}</span><small>per month</small></p>
              <p className="pl-price-note">Full access for the month you pay for.</p>

              <div className="pl-seg" role="radiogroup" aria-label="How you pay monthly">
                <button type="button" role="radio" aria-checked={mode === 'monthly_auto'} onClick={() => setMode('monthly_auto')}>
                  Renews automatically
                </button>
                <button type="button" role="radio" aria-checked={mode === 'monthly_manual'} onClick={() => setMode('monthly_manual')}>
                  Pay month by month
                </button>
              </div>
              <p className="pl-note">
                {mode === 'monthly_auto' ? "Cancel anytime. We'll remind you before any change." : 'Pay each month yourself. No automatic charge.'}
              </p>

              <div className="pl-card-actions">{monthlyCta}</div>
            </article>

            <article className="pl-card pl-card-featured" aria-labelledby="pl-lifetime-title">
              <span className="pl-tag">Best value</span>
              <h2 id="pl-lifetime-title">Lifetime</h2>
              <p className="pl-price"><span>{props.lifetimePrice}</span><small>once</small></p>
              <p className="pl-price-note">Pay once, use forever.</p>
              <ul className="pl-lifetime-list">
                <li>One payment, no renewals to watch</li>
                <li>Every year the bank adds later</li>
              </ul>
              <div className="pl-card-actions">{lifetimeCta}</div>
            </article>
          </div>
          </>
        )}

        {error && <p className="pl-error" role="alert">{error}</p>}

        <section className="pl-unlocks" aria-labelledby="pl-unlocks-title">
          <h2 id="pl-unlocks-title">What premium unlocks</h2>
          <ul className="pl-list">
            {UNLOCKS.map((item) => (
              <li key={item}><Check size={16} aria-hidden="true" />{item}</li>
            ))}
          </ul>
          {!props.premium && (
            <p className="pl-free"><ShieldCheck size={16} aria-hidden="true" />What you keep for free: the latest two years of each exam.</p>
          )}
        </section>

        <p className="pl-trust"><Lock size={14} aria-hidden="true" />Secure payment by Paystack · Card, bank transfer or USSD</p>

        <section className="pl-faq" aria-labelledby="pl-faq-title">
          <h2 id="pl-faq-title">Questions</h2>
          {FAQ.map((item) => (
            <details key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </section>
      </div>
    </main>
  )
}
