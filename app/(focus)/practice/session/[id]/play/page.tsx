import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth/session'
import { getSession } from '@/lib/study-sessions'
import CbtPlayer from '@/components/practice/cbt-player'
import PracticeFeed from '@/components/practice/feed'
import type { PlayerMeta } from '@/components/practice/types'

export const dynamic = 'force-dynamic'

function PlanSkeleton({ mode }: { mode: PlayerMeta['mode'] }) {
  if (mode === 'practice')
    return (
      <main className="feed-page">
        <div className="feed-top" />
        <div className="feed-body">
          <div className="feed-skeleton" />
          <div className="feed-skeleton short" />
        </div>
      </main>
    )
  return <main className="player-page player-focus"><div className="player-skeleton" /><div className="player-skeleton short" /></main>
}

export default async function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireUser()
  const row = await getSession((await params).id, user.id)
  if (!row) notFound()

  // Only what the player needs: no Bank session id leaves the server.
  const meta: PlayerMeta = {
    mode: row.mode === 'cbt' ? 'cbt' : 'practice',
    exam_name: row.exam_name,
    exam_year: row.exam_year,
    subject_names: row.subject_names ?? [],
    feedback_mode: row.feedback_mode === 'instant' ? 'instant' : 'end',
    total_questions: row.total_questions ?? 0,
  }

  return (
    <Suspense fallback={<PlanSkeleton mode={meta.mode} />}>
      {meta.mode === 'cbt' ? <CbtPlayer meta={meta} /> : <PracticeFeed meta={meta} />}
    </Suspense>
  )
}
