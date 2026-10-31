import 'server-only'
import { db } from '@/lib/auth/db'
import { bankFetch, BankRequestError } from '@/lib/bank/client'
import type { PastQUser } from '@/lib/auth/session'

export type StudySession = { id: string; user_id: string; bank_session_id: string; mode: 'practice'|'cbt'; exam_slug: string; exam_name: string; exam_year: number|null; subject_slugs: string[]; subject_names: string[]; total_questions: number; answered_count: number; feedback_mode: 'instant'|'end'; duration_seconds: number|null; status: 'created'|'in_progress'|'submitted'|'expired'|'abandoned'; started_at: string|null; deadline_at: string|null; submitted_at: string|null; last_activity_at: string; result_summary: Record<string, unknown>|null; created_at: string }
const columns = 'id,user_id,bank_session_id,mode,exam_slug,exam_name,exam_year,subject_slugs,subject_names,total_questions,answered_count,feedback_mode,duration_seconds,status,started_at,deadline_at,submitted_at,last_activity_at,result_summary,created_at'
export async function getSession(id: string, userId: string) { const rows = await db<StudySession[]>('study_sessions', {}, `?select=${columns}&id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`); return rows[0] ?? null }
export async function getOpenSessions(userId: string, limit = 3) { return db<StudySession[]>('study_sessions', {}, `?select=${columns}&user_id=eq.${encodeURIComponent(userId)}&status=eq.in_progress&mode=eq.practice&order=created_at.desc&limit=${limit}`) }
export async function syncSession(row: StudySession, user: PastQUser) { if (Date.now() - new Date(row.last_activity_at).getTime() < 20000) return row; const remote = await bankFetch<{data?: Record<string, unknown>}>('/sessions/' + row.bank_session_id, {}, { userId: user.id, tier: 'free' }); const data = remote.data ?? remote as Record<string, unknown>; const patch = { status: data.status, answered_count: data.answered_count, deadline_at: data.deadline_at ?? null, result_summary: data.result_summary ?? null, last_activity_at: new Date().toISOString() }; const updated = await db<StudySession[]>('study_sessions', { method: 'PATCH', body: JSON.stringify(patch) }, `?id=eq.${row.id}&user_id=eq.${user.id}`); return updated[0] ?? { ...row, ...patch } as StudySession }
export async function finishSession(row: StudySession, user: PastQUser) { const remote = await bankFetch<{data?: Record<string, unknown>}>(`/sessions/${row.bank_session_id}/submit`, { method: 'POST', body: JSON.stringify({}) }, { userId: user.id, tier: 'free' }); const data = remote.data ?? remote as Record<string, unknown>; const updated = await db<StudySession[]>('study_sessions', { method: 'PATCH', body: JSON.stringify({ status: 'submitted', submitted_at: new Date().toISOString(), result_summary: data.result_summary ?? data, last_activity_at: new Date().toISOString() }) }, `?id=eq.${row.id}&user_id=eq.${user.id}`); return updated[0] ?? row }
export function friendlyBankError(error: unknown) { if (error instanceof BankRequestError) return error.code; return 'bank_unavailable' }

export type SubmitOutcome = 'submitted' | 'expired'
async function readBankResult(row: StudySession, user: PastQUser) {
  try {
    const remote = await bankFetch<{ data?: Record<string, unknown> }>(`/sessions/${row.bank_session_id}/result`, {}, { userId: user.id, tier: 'free' })
    const data = remote?.data ?? (remote as unknown as Record<string, unknown>)
    return data && typeof data === 'object' ? data : null
  } catch { return null }
}
/** Submits the Bank session and records the final summary on the study session.
 *  Safe to call repeatedly: if the Bank has already finalised the session its
 *  result is read back instead of submitting again. */
export async function submitSession(row: StudySession, user: PastQUser, outcome: SubmitOutcome = 'submitted') {
  let summary: Record<string, unknown> | null = row.result_summary
  let answered: number | null = null
  try {
    const remote = await bankFetch<{ data?: Record<string, unknown> }>(`/sessions/${row.bank_session_id}/submit`, { method: 'POST', body: JSON.stringify({}) }, { userId: user.id, tier: 'free' })
    const data = remote?.data ?? (remote as unknown as Record<string, unknown>)
    if (data && typeof data === 'object') {
      summary = data
      const count = Number((data as Record<string, unknown>).answered)
      if (Number.isFinite(count)) answered = count
    }
  } catch (error) {
    const finalised = error instanceof BankRequestError && [400, 404, 409, 410, 422].includes(error.status)
    if (!finalised) throw error
    summary = (await readBankResult(row, user)) ?? summary
  }
  const submittedAt = row.submitted_at ?? new Date().toISOString()
  const patch: Record<string, unknown> = { status: outcome, submitted_at: submittedAt, result_summary: summary, last_activity_at: new Date().toISOString() }
  if (answered !== null) patch.answered_count = answered
  const updated = await db<StudySession[]>('study_sessions', { method: 'PATCH', body: JSON.stringify(patch) }, `?id=eq.${row.id}&user_id=eq.${user.id}`)
  return updated[0] ?? ({ ...row, ...patch } as StudySession)
}
