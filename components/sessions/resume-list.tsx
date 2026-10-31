import Link from 'next/link'
import { ArrowRight, Clock3 } from 'lucide-react'
import { timeLeft } from '@/lib/session-time'
import type { StudySession } from '@/lib/study-sessions'

const sessionTitle = (session: StudySession) => `${session.exam_name}${session.exam_year ? ` ${session.exam_year}` : ''}`

/** Open sessions on the dashboard: CBT rows carry the time left on the clock. */
export function ResumeList({ sessions }: { sessions: StudySession[] }) {
  if (!sessions.length) {
    return (
      <>
        <p className="eyebrow">Continue where you left off</p>
        <h2>No sessions yet.</h2>
        <p>Pick an exam to start building your momentum.</p>
        <Link href="/practice" className="primary-button small">
          Pick an exam <ArrowRight size={16} />
        </Link>
      </>
    )
  }

  return (
    <>
      <p className="eyebrow">Continue where you left off</p>
      <ul className="resume-list">
        {sessions.map((session) => {
          const left = session.mode === 'cbt' ? timeLeft(session.deadline_at) : null
          const expired = Boolean(left?.expired)
          const href = expired ? `/practice/session/${session.id}/result` : `/practice/session/${session.id}`
          return (
            <li key={session.id}>
              <Link className="resume-row" href={href}>
                <span className="resume-copy">
                  <strong>{sessionTitle(session)}</strong>
                  <small>
                    <span className={session.mode === 'cbt' ? 'resume-tag cbt' : 'resume-tag'}>{session.mode === 'cbt' ? 'CBT' : 'Practice'}</span>
                    {session.subject_names.join(' · ') || 'Mixed subjects'}
                  </small>
                  {left && (
                    <small className={expired ? 'resume-time over' : 'resume-time'}>
                      <Clock3 size={12} aria-hidden="true" /> {expired ? "Time's up · View result" : left.label}
                    </small>
                  )}
                </span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
