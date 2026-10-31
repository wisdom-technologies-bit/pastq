import { notFound, redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/session'
import { getSession, submitSession } from '@/lib/study-sessions'
import { bankFetch } from '@/lib/bank/client'
import { getCbtPlan } from '@/lib/bank/catalog'
import { getTier } from '@/lib/entitlements'
import { db } from '@/lib/auth/db'
import ResultsClient from '@/components/results/results-client'
import { normaliseResult as normalise, type ResultData } from '@/lib/results'

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
    const remote = await bankFetch<Record<string, unknown>>(`/sessions/${row.bank_session_id}/result`, {}, { userId: user.id, tier: getTier(user) })
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
