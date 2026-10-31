import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertSameOrigin } from '@/lib/auth/origin'
import { requireUser } from '@/lib/auth/session'
import { db, rpc } from '@/lib/auth/db'
import { sendReceiptEmail } from '@/lib/billing/notify'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({ reference: z.string().trim().min(4).max(120) })

type Row = { reference: string; plan: 'monthly_auto' | 'monthly_manual' | 'lifetime'; amount_kobo: number; paid_at: string | null }

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

/** Emails a receipt again for one of the signed-in user's own paid charges. */
export async function POST(request: Request) {
  try {
    await assertSameOrigin()
  } catch {
    return json({ error: 'That request did not come from PastQ.' }, 403)
  }

  let userId: string
  try {
    userId = (await requireUser()).user.id
  } catch {
    return json({ error: 'Sign in again to continue.' }, 401)
  }

  const allowed = await rpc<boolean>('check_rate_limit', { p_key: `receipt:${userId}`, p_max: 3, p_window_seconds: 3600 }).catch(() => true)
  if (allowed === false) return json({ error: 'You have asked for a few receipts already. Try again later.' }, 429)

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: 'We could not find that payment.' }, 400)

  const rows = await db<Row[]>('payments', {}, `?select=reference,plan,amount_kobo,paid_at&reference=eq.${encodeURIComponent(parsed.data.reference)}&user_id=eq.${encodeURIComponent(userId)}&status=eq.success&limit=1`).catch(() => [] as Row[])
  const payment = rows?.[0] ?? null
  if (!payment) return json({ error: 'We could not find that payment.' }, 404)

  await sendReceiptEmail(userId, { plan: payment.plan, amountKobo: payment.amount_kobo, paidAt: payment.paid_at, reference: payment.reference })
  return json({ ok: true })
}
