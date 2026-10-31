'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'
import { UpdateCardButton } from './update-card-button'

export type SubscriptionActionsProps = {
  plan: 'monthly_auto' | 'monthly_manual' | 'lifetime' | null
  status: 'active' | 'past_due' | 'cancelled' | 'expired' | null
  premium: boolean
  /** "12 Nov 2026": the end of the paid period, or null when none. */
  endsOn: string | null
  /** "₦2,500": what the next month costs, from the pricing row. */
  renewAmount: string
  cancelAtPeriodEnd: boolean
  hasSubscription: boolean
}

type Busy = 'cancel' | 'manual' | 'auto' | null

/** Everything a premium member can do to their plan, in one calm row. */
export function SubscriptionActions(props: SubscriptionActionsProps) {
  const router = useRouter()
  const [sheet, setSheet] = useState(false)
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!sheet) return
    confirmRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSheet(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheet])

  if (!props.premium) return null

  const { plan, status, endsOn, cancelAtPeriodEnd, hasSubscription } = props
  const renewalStopped = cancelAtPeriodEnd || status === 'cancelled'
  const pastDue = status === 'past_due'

  async function cancelRenewal() {
    if (busy) return
    setBusy('cancel')
    setError('')
    try {
      const response = await fetch('/api/billing/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) {
        setError(body?.error || 'We could not cancel the renewal. Please try again.')
        setBusy(null)
        return
      }
      setSheet(false)
      setBusy(null)
      setNotice(endsOn ? `Renewal cancelled. You keep premium until ${endsOn}.` : 'Renewal cancelled. You keep premium until the end of your period.')
      router.refresh()
    } catch {
      setError('We could not reach PastQ. Check your connection and try again.')
      setBusy(null)
    }
  }

  async function checkout(next: 'monthly_manual' | 'monthly_auto') {
    if (busy) return
    setBusy(next === 'monthly_manual' ? 'manual' : 'auto')
    setError('')
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: next }),
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

  const term = plan === 'lifetime'
    ? 'Lifetime access. No further payments.'
    : pastDue
      ? 'Payment due. Your access continues while the card is sorted out.'
      : plan === 'monthly_manual'
        ? `Valid until ${endsOn ?? 'the end of this month'}. ${props.renewAmount} each month, paid by you.`
        : renewalStopped
          ? `Ends on ${endsOn ?? 'the end of your period'}.`
          : `Renews on ${endsOn ?? 'your next billing date'} at ${props.renewAmount}.`

  return (
    <div className="sub-cta">
      <p className="sub-term">{term}</p>

      <div className="sub-actions">
        {plan === 'monthly_auto' && !renewalStopped && (
          <>
            {!pastDue && hasSubscription && <UpdateCardButton />}
            <button type="button" className="sub-button sub-button-quiet" onClick={() => setSheet(true)}>
              Cancel renewal
            </button>
          </>
        )}

        {plan === 'monthly_auto' && renewalStopped && (
          <Link className="sub-button" href="/plans">Resume premium <ArrowRight size={15} aria-hidden="true" /></Link>
        )}

        {plan === 'monthly_manual' && (
          <>
            <button type="button" className="sub-button" onClick={() => checkout('monthly_manual')} disabled={Boolean(busy)}>
              {busy === 'manual' ? (<><Loader2 size={16} className="sub-spin" aria-hidden="true" /> Opening checkout…</>) : 'Pay for next month'}
            </button>
            <button type="button" className="sub-link" onClick={() => checkout('monthly_auto')} disabled={Boolean(busy)}>
              {busy === 'auto' ? 'Opening checkout…' : 'Switch to automatic renewal'}
            </button>
          </>
        )}

      </div>

      {notice && <p className="sub-note" role="status">{notice}</p>}
      {error && <p className="sub-error" role="alert">{error}</p>}

      {sheet && (
        <div className="sub-sheet-backdrop" role="presentation" onClick={() => !busy && setSheet(false)}>
          <div
            className="sub-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sub-sheet-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="sub-sheet-title">Cancel automatic renewal?</h3>
            <p>
              You&rsquo;ll keep premium until {endsOn ?? 'the end of your paid period'}. After that your account returns to the free plan.
            </p>
            <div className="sub-sheet-actions">
              <button type="button" className="sub-button sub-button-quiet" onClick={() => setSheet(false)} disabled={busy === 'cancel'}>
                Keep it on
              </button>
              <button type="button" ref={confirmRef} className="sub-button sub-button-danger" onClick={cancelRenewal} disabled={busy === 'cancel'}>
                {busy === 'cancel' ? (<><Loader2 size={16} className="sub-spin" aria-hidden="true" /> Cancelling…</>) : 'Cancel renewal'}
              </button>
            </div>
            {error && <p className="sub-error" role="alert">{error}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
