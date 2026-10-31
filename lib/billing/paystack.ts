import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { db } from '@/lib/auth/db'
import { env } from '@/lib/env'

/** Thin, typed wrapper around the Paystack REST API. Server only: the secret
 *  key never leaves this module and provider messages never reach the browser. */

const BASE = 'https://api.paystack.co'
const TIMEOUT_MS = 10_000

export type PaystackErrorCode = 'not_configured' | 'unreachable' | 'rejected'

export class PaystackError extends Error {
  readonly code: PaystackErrorCode
  constructor(code: PaystackErrorCode, message: string) {
    super(message)
    this.name = 'PaystackError'
    this.code = code
  }
}

export const isPaystackConfigured = () => Boolean(env.PAYSTACK_SECRET_KEY)

export type InitializeInput = {
  email: string
  amountKobo: number
  reference: string
  callbackUrl: string
  metadata: Record<string, unknown>
  planCode?: string | null
}

export type InitializedTransaction = { authorizationUrl: string; reference: string; accessCode: string | null }

export type VerifiedTransaction = {
  reference: string
  status: string
  amountKobo: number
  currency: string
  transactionId: number | null
  channel: string | null
  paidAt: string | null
  customerCode: string | null
  customerEmail: string | null
  planCode: string | null
  metadata: Record<string, unknown> | null
}

type Envelope<T> = { status?: boolean; message?: string; data?: T }

const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)
const num = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : null)

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = env.PAYSTACK_SECRET_KEY
  if (!key) throw new PaystackError('not_configured', 'Payments are not available right now. Please try again later.')

  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new PaystackError('unreachable', 'We could not reach Paystack. Check your connection and try again.')
  }

  const body = (await response.json().catch(() => null)) as Envelope<T> | null
  if (!response.ok || !body || body.status === false || body.data === undefined) {
    // The provider message can carry account detail, so it stays out of the copy
    // we hand back to the page.
    throw new PaystackError('rejected', 'Paystack could not complete that request. Please try again in a moment.')
  }
  return body.data
}

export async function initializeTransaction(input: InitializeInput): Promise<InitializedTransaction> {
  const data = await request<{ authorization_url?: string; access_code?: string; reference?: string }>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      currency: 'NGN',
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
      ...(input.planCode ? { plan: input.planCode } : {}),
    }),
  })
  const authorizationUrl = str(data.authorization_url)
  const reference = str(data.reference) ?? input.reference
  if (!authorizationUrl) throw new PaystackError('rejected', 'Paystack did not return a checkout link. Please try again.')
  return { authorizationUrl, reference, accessCode: str(data.access_code) }
}

export async function verifyTransaction(reference: string): Promise<VerifiedTransaction> {
  const clean = reference.trim()
  if (!clean) throw new PaystackError('rejected', 'That payment reference is not valid.')
  const data = await request<Record<string, unknown>>(`/transaction/verify/${encodeURIComponent(clean)}`)
  const customer = (data.customer ?? null) as Record<string, unknown> | null
  const plan = data.plan ?? null
  const metadata = (data.metadata ?? null) as Record<string, unknown> | null
  return {
    reference: str(data.reference) ?? clean,
    status: (str(data.status) ?? 'unknown').toLowerCase(),
    amountKobo: num(data.amount) ?? 0,
    currency: (str(data.currency) ?? '').toUpperCase(),
    transactionId: num(data.id),
    channel: str(data.channel),
    paidAt: str(data.paid_at),
    customerCode: customer ? str(customer.customer_code) : null,
    customerEmail: customer ? str(customer.email)?.toLowerCase() ?? null : null,
    planCode: typeof plan === 'object' && plan ? str((plan as Record<string, unknown>).plan_code) : str(plan),
    metadata: metadata ?? null,
  }
}

export async function createPlan(amountKobo: number): Promise<string> {
  const data = await request<{ plan_code?: string }>('/plan', {
    method: 'POST',
    body: JSON.stringify({ name: 'PastQ premium monthly', interval: 'monthly', amount: Math.round(amountKobo), currency: 'NGN' }),
  })
  const planCode = str(data.plan_code)
  if (!planCode) throw new PaystackError('rejected', 'Paystack did not return a plan code.')
  return planCode
}

type PlanRow = { plan_code: string }

/** One Paystack plan per monthly amount: the same price always reuses its code. */
export async function getOrCreatePlan(amountKobo: number): Promise<{ planCode: string }> {
  const amount = Math.round(amountKobo)
  const query = `?select=plan_code&amount_kobo=eq.${amount}&currency=eq.NGN&interval=eq.monthly&limit=1`
  const existing = await db<PlanRow[]>('paystack_plans', {}, query)
  if (existing?.[0]?.plan_code) return { planCode: existing[0].plan_code }

  const planCode = await createPlan(amount)
  // Another request may have created the same plan while this one was waiting;
  // the insert is idempotent and the re-read returns whichever code won.
  await db('paystack_plans', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ amount_kobo: amount, currency: 'NGN', interval: 'monthly', plan_code: planCode }),
  }, '?on_conflict=amount_kobo,currency,interval').catch(() => undefined)

  const stored = await db<PlanRow[]>('paystack_plans', {}, query)
  return { planCode: stored?.[0]?.plan_code ?? planCode }
}

/** Best effort: stopping the old subscription must never break a lifetime grant. */
export async function disableSubscription(code: string, token: string): Promise<boolean> {
  try {
    await request(`/subscription/disable`, { method: 'POST', body: JSON.stringify({ code, token }) })
    return true
  } catch {
    return false
  }
}

/** The page Paystack shows customers to manage a subscription. */
export function getManageLink(subscriptionCode: string, emailToken?: string | null): string {
  const code = encodeURIComponent(subscriptionCode.trim())
  const token = emailToken?.trim()
  return `https://paystack.com/manage/subscriptions/${code}${token ? `?email_token=${encodeURIComponent(token)}` : ''}`
}

/** HMAC SHA512 of the raw request body, compared without leaking timing. */
export function verifySignature(rawBody: string, header: string | null): boolean {
  const key = env.PAYSTACK_SECRET_KEY
  if (!key || !header) return false
  const expected = createHmac('sha512', key).update(rawBody).digest('hex')
  const provided = header.trim().toLowerCase()
  if (!/^[0-9a-f]+$/.test(provided) || provided.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'))
  } catch {
    return false
  }
}

/** One safe sentence for any billing failure, whatever went wrong upstream. */
export function billingMessage(error: unknown): string {
  if (error instanceof PaystackError) return error.message
  return 'We could not start the payment. Please try again in a moment.'
}
