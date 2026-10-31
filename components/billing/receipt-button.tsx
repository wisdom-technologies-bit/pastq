'use client'

import { useState } from 'react'

/** Sends the receipt for one paid row again. Rate limited on the server. */
export function ReceiptButton({ reference }: { reference: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle')
  const [error, setError] = useState('')

  async function send() {
    if (state === 'busy' || state === 'sent') return
    setState('busy')
    setError('')
    try {
      const response = await fetch('/api/billing/receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        setError(body?.error || 'We could not send that receipt.')
        setState('idle')
        return
      }
      setState('sent')
    } catch {
      setError('We could not reach PastQ.')
      setState('idle')
    }
  }

  if (error) {
    return (
      <span className="sub-receipt-cell">
        <button type="button" className="sub-receipt" onClick={send}>Try again</button>
        <span className="sub-receipt-error" role="alert">{error}</span>
      </span>
    )
  }

  return (
    <span className="sub-receipt-cell">
      <button type="button" className="sub-receipt" onClick={send} disabled={state !== 'idle'}>
        {state === 'sent' ? 'Sent' : state === 'busy' ? 'Sending…' : 'Receipt'}
      </button>
    </span>
  )
}
