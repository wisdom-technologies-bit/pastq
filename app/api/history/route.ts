import { NextResponse } from 'next/server'
import { assertSameOrigin } from '@/lib/auth/origin'
import { requireUser } from '@/lib/auth/session'
import { getHistoryPage } from '@/lib/progress'

export async function GET(request: Request) {
  await assertSameOrigin()
  const { user } = await requireUser()
  const url = new URL(request.url)
  const mode = url.searchParams.get('mode')
  const exam = url.searchParams.get('exam')
  const cursor = url.searchParams.get('cursor')
  const limit = Number(url.searchParams.get('limit') ?? 20)
  const page = await getHistoryPage(user.id, {
    mode: mode === 'practice' || mode === 'cbt' ? mode : undefined,
    exam: exam || undefined,
    cursor: cursor || undefined,
    limit: Number.isFinite(limit) ? limit : 20,
  })
  return NextResponse.json(page, { headers: { 'Cache-Control': 'private, no-store' } })
}
