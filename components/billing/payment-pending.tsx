'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/** Polls our own status endpoint while Paystack settles the charge. Never
 *  grants anything: the server does that, this only asks whether it has. */
const INTERVAL_MS = 2_500
const WINDOW_MS = 30_000

export function PaymentPending({ reference }: { reference: string }) {
  const router = useRouter()
  const [waited, setWaited] = useState(false)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const startedAt = Date.now()

    const poll = async () => {
      if (cancelled) return
      try {
        const response = await fetch(`/api/billing/status?reference=${encodeURIComponent(reference)}`, { cache: 'no-store' })
        const body = (await response.json().catch(() => null)) as { status?: string } | null
        const status = body?.status
        if (!cancelled && (status === 'success' || status === 'failed' || status === 'abandoned')) {
          router.refresh()
          return
        }
      } catch {
        // A dropped request is not an answer; keep trying inside the window.
      }
      if (cancelled) return
      if (Date.now() - startedAt >= WINDOW_MS) {
        setWaited(true)
        return
      }
      timer = setTimeout(poll, INTERVAL_MS)
    }

    timer = setTimeout(poll, INTERVAL_MS)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [reference, router])

  if (waited) {
    return (
      <section className="pay-card" aria-live="polite">
        <span className="pay-mark pay-mark-quiet" aria-hidden="true"><Loader2 size={22} className="pay-spin" /></span>
        <h1 className="pay-title">Still confirming</h1>
        <p className="pay-lede">We&rsquo;re still confirming your payment. You&rsquo;ll get an email once it&rsquo;s done.</p>
        <div className="pay-actions">
          <Link className="pay-button" href="/app">Back to PastQ</Link>
        </div>
        <p className="pay-note">Your reference is <span className="pay-ref">{reference.toUpperCase()}</span>.</p>
      </section>
    )
  }

  return (
    <section className="pay-card" aria-live="polite">
      <span className="pay-mark pay-mark-quiet" aria-hidden="true"><Loader2 size={22} className="pay-spin" /></span>
      <h1 className="pay-title">Confirming your payment</h1>
      <p className="pay-lede">Paystack is finishing up. This usually takes a few seconds, so keep this page open.</p>
      <div className="pay-actions">
        <Link className="pay-button pay-button-quiet" href="/app">Back to PastQ</Link>
      </div>
      <p className="pay-note">Your reference is <span className="pay-ref">{reference.toUpperCase()}</span>.</p>
    </section>
  )
}
