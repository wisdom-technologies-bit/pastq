import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireUser } from '@/lib/auth/session'
import { getSession, syncSession } from '@/lib/study-sessions'
import { timeLeft } from '@/lib/session-time'
import { SessionActions } from './session-actions'

export default async function SessionOverview({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireUser()
  const row = await getSession((await params).id, user.id)
  if (!row) notFound()

  const session = await syncSession(row, user)
  const result = (session.result_summary ?? {}) as Record<string, unknown>
  const complete = ['submitted', 'expired', 'abandoned'].includes(session.status)
  const percent = Number(result.percent ?? result.score_percent ?? 0)
  const total = session.total_questions || 0
  const answered = session.answered_count || 0
  const progress = total ? Math.min(100, (answered / total) * 100) : 0
  const isCbt = session.mode === 'cbt'
  const left = timeLeft(session.deadline_at)

  return (
    <main className="session-page">
      <header className="session-top">
        <Link href={isCbt ? '/cbt' : '/practice'} className="icon-button" aria-label={isCbt ? 'Back to CBT' : 'Back to Practice'}>
          <ArrowLeft />
        </Link>
      </header>
      <section className="session-card">
        <p className="eyebrow">
          {isCbt ? 'CBT' : 'Practice'} · {session.exam_name} {session.exam_year ?? 'Mixed drill'}
        </p>
        <h1>{session.subject_names.join(' · ')}</h1>

        {complete ? (
          <>
            <div className="result-percent">{percent}%</div>
            <div className="session-stats">
              <span><b>{Number(result.correct ?? 0)}</b> correct</span>
              <span><b>{Number(result.wrong ?? 0)}</b> wrong</span>
              <span><b>{Number(result.unanswered ?? 0)}</b> unanswered</span>
              <span><b>{Math.round(Number(result.time_used_seconds ?? 0) / 60)}m</b> time used</span>
            </div>
            <Link className="secondary-button session-finish" href={isCbt ? `/practice/session/${session.id}/result` : '/practice'}>
              {isCbt ? 'View result' : 'Back to practice'}
            </Link>
          </>
        ) : (
          <>
            {isCbt && session.deadline_at && (
              <div className={`session-timer${left.expired ? ' expired' : ''}`}>
                <span className="session-timer-value">{left.label}</span>
                <small>{left.expired ? 'Time is up — open the exam to submit' : 'Time left on the clock'}</small>
              </div>
            )}
            <div className="session-stats">
              <span><b>{total}</b> questions</span>
              {!isCbt && <span><b>{session.feedback_mode === 'instant' ? 'Instant' : 'End'}</b> feedback</span>}
              <span><b>{answered} of {total}</b> answered</span>
            </div>
            <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
            <p className="session-last">Last activity {new Date(session.last_activity_at).toLocaleString()}</p>
            <SessionActions id={session.id} canResume={answered > 0} mode={isCbt ? 'cbt' : 'practice'} expired={left.expired} />
          </>
        )}
      </section>
    </main>
  )
}
