import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { getTier } from '@/lib/entitlements'
import { getSession } from '@/lib/study-sessions'
import { bankFetch } from '@/lib/bank/client'

type Record_ = Record<string, unknown>
const out = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
const num = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value : '')

type Subject = { slug: string; name: string; question_count: number; first_position: number }

// The Bank is the clock and the source of truth for progress. Everything here is
// derived on the server so the client never needs (or sees) the Bank session id.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireUser()
  const row = await getSession((await params).id, user.id)
  if (!row) return out({ error: 'Not found' }, 404)

  let remote: Record_ = {}
  let reachable = true
  try {
    const body = await bankFetch<Record_>(`/sessions/${row.bank_session_id}`, {}, { userId: user.id, tier: getTier(user) })
    remote = (body?.data ?? body ?? {}) as Record_
  } catch {
    reachable = false
  }

  const progress = (remote.progress ?? {}) as Record_
  const total = num(remote.total_questions ?? remote.total ?? progress.total, row.total_questions)
  const answered = num(remote.answered ?? remote.answered_count ?? progress.answered, row.answered_count)
  const flagged = num(remote.flagged ?? remote.flagged_count ?? progress.flagged, 0)

  const rawSubjects = Array.isArray(remote.subjects) ? (remote.subjects as Record_[]) : []
  let cursor = 1
  const subjects: Subject[] = rawSubjects
    .map((item, index) => {
      const count = num(item.question_count ?? item.count ?? item.questions ?? item.total, 0)
      const start = num(item.first_position ?? item.start ?? item.from, 0)
      const subject: Subject = {
        slug: str(item.slug ?? item.subject ?? item.subject_slug) || `subject-${index + 1}`,
        name: str(item.name ?? item.subject_name ?? item.label ?? item.slug) || `Subject ${index + 1}`,
        question_count: count,
        first_position: start,
      }
      return subject
    })
    .filter((subject) => subject.question_count > 0)

  if (!subjects.length && row.subject_slugs.length) {
    // Fall back to the catalog names on the study session; positions are unknown,
    // so the player groups by the subject on each question instead.
    row.subject_slugs.forEach((slug, index) => subjects.push({ slug, name: row.subject_names[index] ?? slug, question_count: 0, first_position: 0 }))
  }
  for (const subject of subjects) {
    if (subject.question_count > 0) {
      if (subject.first_position < 1) subject.first_position = cursor
      cursor = subject.first_position + subject.question_count
    }
  }

  return out({
    status: str(remote.status) || row.status,
    deadline_at: str(remote.deadline_at) || row.deadline_at || null,
    server_now: str(remote.server_time ?? remote.server_now ?? remote.now) || new Date().toISOString(),
    answered: Math.min(Math.max(0, answered), total || answered),
    total,
    flagged: Math.max(0, flagged),
    subjects,
    reachable,
  })
}
