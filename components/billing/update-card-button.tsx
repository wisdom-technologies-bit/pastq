'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

/** Opens Paystack's card page for this subscription. The link is fetched on
 *  click, so nothing sensitive sits in the page source. */
export function UpdateCardButton({ className = 'sub-button', label = 'Update card' }: { className?: string; label?: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function open() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/billing/manage-link', { cache: 'no-store' })
      const body = (await response.json().catch(() => null)) as { url?: string; error?: string } | null
      const url = typeof body?.url === 'string' ? body.url : ''
      if (!response.ok || !url.startsWith('https://')) {
        setError(body?.error || 'We could not open the card page. Please try again.')
        setBusy(false)
        return
      }
      window.location.href = url
    } catch {
      setError('We could not reach PastQ. Check your connection and try again.')
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={open} disabled={busy}>
        {busy ? (<><Loader2 size={16} className="sub-spin" aria-hidden="true" /> Opening…</>) : label}
      </button>
      {error && <p className="sub-error" role="alert">{error}</p>}
    </>
  )
}
