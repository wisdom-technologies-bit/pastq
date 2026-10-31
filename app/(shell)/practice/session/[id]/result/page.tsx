import { notFound, redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/session'
import { getSession, submitSession } from '@/lib/study-sessions'
import { bankFetch } from '@/lib/bank/client'
import { db } from '@/lib/auth/db'
import ResultsClient from '@/components/results/results-client'

const deadLinePassed = (deadline: string | null) => Boolean(deadline) && new Date(deadline as string).getTime() <= Date.now()

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireUser()
  const found = await getSession((await params).id, user.id)
  if (!found) notFound()
  let row = found

  // A CBT session whose time ran out while the tab was closed is finished here,
  // so the student lands on their result instead of bouncing back to the player.
  if (row.status === 'in_progress' && deadLinePassed(row.deadline_at)) {
    try {
      row = await submitSession(row, user, 'expired')
    } catch {
      redirect(`/practice/session/${row.id}/play`)
    }
  }
  if (row.status !== 'submitted' && row.status !== 'expired') redirect(`/practice/session/${row.id}/play`)

  let result = row.result_summary
  let failed = false
  try {
    const remote = await bankFetch<any>(`/sessions/${row.bank_session_id}/result`, {}, { userId: user.id, tier: 'free' })
    const latest = remote.data ?? remote
    const summary = { total: latest.total, answered: latest.answered, correct: latest.correct, wrong: latest.wrong, unanswered: latest.unanswered, percent: latest.percent, time_used_seconds: latest.time_used_seconds, subjects: latest.subjects, score_400: latest.score_400 ?? null }
    result = result ? { ...result, time_used_seconds: summary.time_used_seconds, score_400: summary.score_400 } : summary
    if (!row.result_summary) {
      await db('study_sessions', { method: 'PATCH', body: JSON.stringify({ status: row.status, submitted_at: row.submitted_at ?? new Date().toISOString(), answered_count: summary.answered, result_summary: summary }) }, `?id=eq.${row.id}&user_id=eq.${user.id}`)
    }
  } catch {
    failed = true
  }
  return <ResultsClient session={row} result={result! as any} failed={failed} />
}
