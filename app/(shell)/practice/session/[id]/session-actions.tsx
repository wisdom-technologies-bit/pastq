'use client'
import Link from 'next/link'

export function SessionActions({
  id,
  canResume,
  mode = 'practice',
  expired = false,
}: {
  id: string
  canResume: boolean
  mode?: 'practice' | 'cbt'
  expired?: boolean
}) {
  if (mode === 'cbt') {
    return (
      <div className="session-actions">
        <Link className="primary-button" href={expired ? `/practice/session/${id}/result` : `/practice/session/${id}/play`}>
          {expired ? "Time's up · View result" : 'Resume exam'}
        </Link>
      </div>
    )
  }
  return (
    <div className="session-actions">
      <Link className="primary-button" href={`/practice/session/${id}/play`}>{canResume ? 'Resume' : 'Start'}</Link>
      <Link className="secondary-button" href="/practice">Finish session</Link>
    </div>
  )
}
