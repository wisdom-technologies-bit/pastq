import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/auth/db'
import { getManageLink } from '@/lib/billing/paystack'

export const dynamic = 'force-dynamic'

type Row = { plan: 'monthly_auto' | 'monthly_manual' | 'lifetime'; paystack_subscription_code: string | null }

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

/** The Paystack page where a customer changes the card on a subscription.
 *  Only the subscription code is used, so no token ever reaches the browser. */
export async function GET() {
  let userId: string
  try {
    userId = (await requireUser()).user.id
  } catch {
    return json({ error: 'Sign in again to continue.' }, 401)
  }

  const rows = await db<Row[]>('entitlements', {}, `?select=plan,paystack_subscription_code&user_id=eq.${encodeURIComponent(userId)}&limit=1`).catch(() => [] as Row[])
  const row = rows?.[0] ?? null

  if (row?.plan !== 'monthly_auto' || !row.paystack_subscription_code) {
    return json({ error: 'There is no card on file to update.' }, 404)
  }

  return json({ url: getManageLink(row.paystack_subscription_code) })
}
