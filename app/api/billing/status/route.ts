import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { db } from '@/lib/auth/db'

export const dynamic = 'force-dynamic'

/** Polled by the callback page. Scoped to the signed-in user's own payment. */
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' }
  let userId: string
  try {
    userId = (await requireUser()).user.id
  } catch {
    return NextResponse.json({ error: 'Sign in again to continue.' }, { status: 401, headers })
  }

  const reference = (new URL(request.url).searchParams.get('reference') ?? '').trim().slice(0, 120)
  if (!reference) return NextResponse.json({ status: 'unknown' }, { headers })

  const rows = await db<Array<{ status: string }>>('payments', {}, `?select=status&reference=eq.${encodeURIComponent(reference)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`).catch(() => [])
  return NextResponse.json({ status: rows?.[0]?.status ?? 'unknown' }, { headers })
}
