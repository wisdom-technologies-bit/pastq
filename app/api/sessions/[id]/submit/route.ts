import { NextResponse } from 'next/server'
import { assertSameOrigin } from '@/lib/auth/origin'
import { requireUser } from '@/lib/auth/session'
import { getSession, submitSession } from '@/lib/study-sessions'
function out(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } }) }
// Idempotent: submitting again returns the stored summary instead of resubmitting.
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertSameOrigin()
  const { user } = await requireUser()
  const row = await getSession((await params).id, user.id)
  if (!row) return out({ error: 'Not found' }, 404)
  if (row.status === 'submitted' || row.status === 'expired') return out({ data: row.result_summary })
  const late = row.deadline_at ? new Date(row.deadline_at).getTime() <= Date.now() : false
  try {
    const updated = await submitSession(row, user, late ? 'expired' : 'submitted')
    return out({ data: updated.result_summary })
  } catch {
    return out({ error: 'We could not submit this exam right now. Please try again.' }, 502)
  }
}
