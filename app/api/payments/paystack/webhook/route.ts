import { NextResponse } from 'next/server'
import {
  applySuccessfulCharge,
  linkSubscription,
  markSubscriptionPastDue,
  claimPaymentEvent,
  stopRenewal,
} from '@/lib/billing/apply'
import { notifyPaymentFailed } from '@/lib/billing/notify'
import { verifySignature } from '@/lib/billing/paystack'

export const dynamic = 'force-dynamic'

/** Paystack postbacks. Signature checked on the raw body, no cookies, no
 *  same-origin check, and never a log of the payload or the tokens inside it. */

type PaystackEvent = { event?: unknown; data?: Record<string, unknown> }

const ok = () => NextResponse.json({ received: true }, { headers: { 'Cache-Control': 'no-store' } })
const retry = () => NextResponse.json({ error: 'Retry' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })

/** Only these change anything. Everything else is acknowledged and dropped. */
const HANDLED = new Set(['subscription.create', 'invoice.payment_failed', 'subscription.disable', 'subscription.not_renew', 'invoice.update'])

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)
const scalar = (value: unknown) => text(value) ?? (typeof value === 'number' ? String(value) : null)

export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifySignature(raw, request.headers.get('x-paystack-signature'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  let payload: PaystackEvent
  try {
    payload = JSON.parse(raw) as PaystackEvent
  } catch {
    return ok()
  }

  const type = text(payload.event)
  const data = (payload.data ?? {}) as Record<string, unknown>
  if (!type) return ok()

  const reference = text(data.reference)
  const subscriptionCode = text(data.subscription_code)
  const customer = (data.customer ?? {}) as Record<string, unknown>
  const customerCode = text(customer.customer_code)
  const email = text(customer.email)?.toLowerCase() ?? null
  const metadata = (data.metadata ?? null) as Record<string, unknown> | null

  const eventKey = `${type}:${scalar(data.reference) ?? scalar(data.subscription_code) ?? scalar(data.id) ?? ''}`
  if (eventKey.endsWith(':')) return ok()

  try {
    if (type === 'charge.success') {
      // The charge path writes its own event row and is idempotent on the
      // reference, so a repeated postback cannot grant twice.
      if (reference) await applySuccessfulCharge(reference, 'webhook')
      return ok()
    }

    // Nothing to record and nothing to do: answer before touching the database.
    if (!HANDLED.has(type)) return ok()

    // Every other event is only interesting once.
    const claim = await claimPaymentEvent(eventKey, type, reference ?? subscriptionCode)
    if (claim === 'error') return retry()
    if (claim === 'duplicate') return ok()

    if (type === 'subscription.create') {
      if (subscriptionCode) {
        await linkSubscription({
          subscriptionCode,
          emailToken: text(data.email_token),
          customerCode,
          nextPaymentDate: text(data.next_payment_date),
          metadata,
          email,
        })
      }
      return ok()
    }

    if (type === 'invoice.payment_failed') {
      const { userId } = await markSubscriptionPastDue({ subscriptionCode, customerCode, email })
      if (userId) await notifyPaymentFailed(userId)
      return ok()
    }

    if (type === 'subscription.disable') {
      await stopRenewal({ subscriptionCode, customerCode, email, disabled: true })
      return ok()
    }

    if (type === 'subscription.not_renew') {
      await stopRenewal({ subscriptionCode, customerCode, email, disabled: false })
      return ok()
    }

    if (type === 'invoice.update') {
      // A paid invoice is a renewal. The reference keeps this in step with the
      // charge.success that normally follows or precedes it.
      const transaction = (data.transaction ?? {}) as Record<string, unknown>
      const renewalReference = text(transaction.reference) ?? (text(data.status) === 'success' ? reference : null)
      if (text(data.status) === 'success' && renewalReference) await applySuccessfulCharge(renewalReference, 'renewal')
      return ok()
    }

    return ok()
  } catch {
    // Only a transient database failure reaches here, and Paystack should retry.
    return retry()
  }
}
