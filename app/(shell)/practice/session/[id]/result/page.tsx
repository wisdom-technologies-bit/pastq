import { notFound, redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/session'
import { getSession, submitSession } from '@/lib/study-sessions'
import { bankFetch } from '@/lib/bank/client'
import { getCbtPlan } from '@/lib/bank/catalog'
import { getTier } from '@/lib/entitlements'
import { db } from '@/lib/auth/db'
import ResultsClient, { type ResultData, type SubjectResult } from '@/components/results/results-client'

const num = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
const optionalNum = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Coerces whatever the Bank or the stored summary holds into one strict shape.
 *  Only counts are kept: never question text. */
function normalise(raw: unknown): ResultData | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const subjects: SubjectResult[] = Array.isArray(source.subjects)
    ? (source.subjects as Record<string, unknown>[])
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
          const total = num(item.total)
          const correct = num(item.correct)
          const answered = num(item.answered, correct + num(item.wrong))
          return {
            slug: String(item.slug ?? item.name ?? ''),
            name: String(item.name ?? item.slug ?? 'Subject'),
            total,
            answered,
            correct,
            wrong: num(item.wrong),
            unanswered: num(item.unanswered, Math.max(0, total - answered)),
            percent: num(item.percent, total > 0 ? (correct / total) * 100 : 0),
            score_100: optionalNum(item.score_100),
          }
        })
    : []
  const total = num(source.total)
  const answered = num(source.answered, subjects.reduce((sum, subject) => sum + subject.answered, 0))
  const correct = num(source.correct, subjects.reduce((sum, subject) => sum + subject.correct, 0))
  return {
    total,
    answered,
    correct,
    wrong: num(source.wrong, Math.max(0, answered - correct)),
    unanswered: num(source.unanswered, Math.max(0, total - answered)),
    percent: num(source.percent, total > 0 ? (correct / total) * 100 : 0),
    time_used_seconds: num(source.time_used_seconds ?? source.time_used),
    score_400: optionalNum(source.score_400),
    subjects,
  }
}

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireUser()
  const found = await getSession((await params).id, user.id)
  if (!found) notFound()
  let row = found

  // A CBT session whose time ran out while the tab was closed is finished here,
  // so the student lands on their result instead of bouncing back to the player.
  const deadlinePassed = Boolean(row.deadline_at) && new Date(row.deadline_at as string).getTime() <= Date.now()
  if (row.status === 'in_progress' && deadlinePassed) {
    try {
      row = await submitSession(row, user, 'expired')
    } catch {
      redirect(`/practice/session/${row.id}/play`)
    }
  }
  if (row.status !== 'submitted' && row.status !== 'expired') redirect(`/practice/session/${row.id}/play`)

  let result = normalise(row.result_summary)
  let failed = false
  try {
    const remote = await bankFetch<Record<string, unknown>>(`/sessions/${row.bank_session_id}/result`, {}, { userId: user.id, tier: 'free' })
    const fresh = normalise(remote?.data ?? remote)
    if (fresh && fresh.total > 0) result = fresh
    if (!row.result_summary && fresh) {
      await db(
        'study_sessions',
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: row.status,
            submitted_at: row.submitted_at ?? new Date().toISOString(),
            answered_count: fresh.answered,
            result_summary: { ...fresh },
          }),
        },
        `?id=eq.${row.id}&user_id=eq.${user.id}`,
      )
    }
  } catch {
    if (!result) failed = true
  }

  // A CBT retake repeats the same paper: skip a missing compulsory unless this
  // sitting actually borrowed it.
  const retake: { missingCompulsory?: 'skip' | 'borrow'; subjects?: string[] } = {}
  if (row.mode === 'cbt' && row.exam_year) {
    try {
      const plan = await getCbtPlan(row.exam_slug, row.exam_year, getTier(user))
      if (plan.missing) {
        const compulsory = plan.compulsorySubject
        const slugs = row.subject_slugs ?? []
        const borrowed = Boolean(compulsory && slugs.includes(compulsory))
        retake.missingCompulsory = borrowed ? 'borrow' : 'skip'
        // The Bank re-adds a borrowed subject itself, so never send it twice.
        if (borrowed && compulsory) retake.subjects = slugs.filter((slug) => slug !== compulsory)
      }
    } catch {
      // Leave it unset so the Bank decides.
    }
  }

  return <ResultsClient session={row} result={result} failed={failed} retake={retake} />
}
