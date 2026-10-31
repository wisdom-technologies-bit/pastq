import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { assertSameOrigin } from '@/lib/auth/origin'
import { requireUser } from '@/lib/auth/session'
import { db, rpc } from '@/lib/auth/db'
import { env } from '@/lib/env'
import { getPricing } from '@/lib/billing/pricing'
import { billingMessage, getOrCreatePlan, initializeTransaction, isPaystackConfigured } from '@/lib/billing/paystack'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({ plan: z.enum(['monthly_auto', 'monthly_manual', 'lifetime']) })

type EntitlementState = { plan: string; status: string; current_period_end: string | null }

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const appUrl = (request: Request) => (env.APP_URL || new URL(request.url).origin).replace(/\/+$/, '')
const paidUntil = (value: string | null) => {
  const parsed = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : 0
}

export async function POST(request: Request) {
  try {
    await assertSameOrigin()
  } catch {
    return json({ error: 'That request did not come from PastQ.' }, 403)
  }

  let user
  try {
    user = (await requireUser()).user
  } catch {
    return json({ error: 'Sign in again to continue.' }, 401)
  }

  if (!isPaystackConfigured()) return json({ error: 'Payments are not available right now. Please try again later.' }, 503)

  const allowed = await rpc<boolean>('check_rate_limit', { p_key: `checkout:${user.id}`, p_max: 5, p_window_seconds: 60 }).catch(() => true)
  if (allowed === false) return json({ error: 'Too many attempts. Give it a minute and try again.' }, 429)

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: 'Choose a plan to continue.' }, 400)
  const plan = parsed.data.plan

  const states = await db<EntitlementState[]>('entitlements', {}, `?select=plan,status,current_period_end&user_id=eq.${encodeURIComponent(user.id)}&limit=1`).catch(() => [] as EntitlementState[])
  const current = states?.[0] ?? null
  const now = Date.now()
  const stillPaid = paidUntil(current?.current_period_end ?? null) > now

  if (current?.plan === 'lifetime' && current.status === 'active') {
    return json({ error: 'You already have lifetime access. Nothing more to pay.' }, 409)
  }
  if (plan !== 'lifetime' && current?.plan === 'monthly_auto' && (current.status === 'active' || current.status === 'past_due') && stillPaid) {
    return json({ error: 'Your monthly plan already renews automatically. Manage it from your subscription page.' }, 409)
  }

  const pricing = await getPricing()
  const amountKobo = plan === 'lifetime' ? pricing.lifetimeKobo : pricing.monthlyKobo
  const reference = `pq_${plan}_${randomUUID().replace(/-/g, '')}`

  let paymentId: string
  try {
    const rows = await db<Array<{ id: string }>>('payments', {
      method: 'POST',
      body: JSON.stringify({ user_id: user.id, reference, plan, amount_kobo: amountKobo, currency: 'NGN', status: 'pending' }),
    })
    const created = rows?.[0]?.id
    if (!created) throw new Error('missing row')
    paymentId = created
  } catch {
    return json({ error: 'We could not start the payment. Please try again.' }, 503)
  }

  try {
    const planCode = plan === 'monthly_auto' ? (await getOrCreatePlan(amountKobo)).planCode : null
    const initialized = await initializeTransaction({
      email: user.email,
      amountKobo,
      reference,
      callbackUrl: `${appUrl(request)}/payments/callback`,
      metadata: { user_id: user.id, plan, payment_id: paymentId },
      planCode,
    })
    return json({ url: initialized.authorizationUrl })
  } catch (error) {
    await db('payments', { method: 'PATCH', body: JSON.stringify({ status: 'failed' }) }, `?id=eq.${encodeURIComponent(paymentId)}&status=eq.pending`).catch(() => undefined)
    return json({ error: billingMessage(error) }, 502)
  }
}
