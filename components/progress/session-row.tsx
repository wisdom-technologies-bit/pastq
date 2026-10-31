import Link from 'next/link'
import { durationLabel } from '@/lib/dates'
import type { HistoryItem } from '@/lib/progress'

export type Tone = 'good' | 'mid' | 'low' | 'none'

/** Same thresholds the results screen uses for its ring and bars. */
export function toneOf(percent: number | null): Tone {
  if (percent === null) return 'none'
  if (percent >= 70) return 'good'
  if (percent >= 50) return 'mid'
  return 'low'
}

export function SessionRow({ item, action = 'review' }: { item: HistoryItem; action?: 'review' | 'none' }) {
  const cbt = item.mode === 'cbt'
  const inProgress = item.status === 'in_progress'
  const percent = item.percent
  const tone = toneOf(percent)
  const score = cbt && typeof item.score_400 === 'number' ? item.score_400 : null
  const href = inProgress ? `/practice/session/${item.id}/play` : `/practice/session/${item.id}/result`
  const isBlank = !inProgress && percent === null

  return (
    <article className={`pg-row pg-row-${tone}`}>
      <Link className="pg-row-main" href={href} aria-label={`${item.exam_name} ${item.exam_year ?? ''} ${cbt ? 'CBT' : 'practice'} session`}>
        <span className="pg-row-head">
          <span className={`pg-badge ${cbt ? 'is-cbt' : 'is-practice'}`}>{cbt ? 'CBT' : 'Practice'}</span>
          <span className="pg-row-title">
            {item.exam_name}
            {item.exam_year ? ` ${item.exam_year}` : ''}
          </span>
        </span>
        <span className="pg-row-subjects">{item.subject_names.length ? item.subject_names.join(' · ') : `${item.total_questions} questions`}</span>
        <span className="pg-row-meta">
          <span>
            {item.correct}/{item.total || item.total_questions}
          </span>
          {typeof item.time_used_seconds === 'number' && item.time_used_seconds > 0 && <span>{durationLabel(item.time_used_seconds)}</span>}
        </span>
      </Link>
      <div className="pg-row-side">
        {score !== null ? (
          <span className={`pg-row-value pg-value-${tone}`}>
            {score}
            <small>/400</small>
          </span>
        ) : percent !== null ? (
          <span className={`pg-row-value pg-value-${tone}`}>
            {percent}
            <small>%</small>
          </span>
        ) : inProgress ? (
          <span className="pg-pill">In progress</span>
        ) : isBlank ? (
          <span className="pg-row-value pg-value-none">No answers</span>
        ) : null}
        {inProgress ? (
          <Link className="pg-resume" href={`/practice/session/${item.id}/play`}>
            Resume
          </Link>
        ) : action === 'review' ? (
          <Link className="pg-text-link" href={`/practice/session/${item.id}/review`}>
            Review
          </Link>
        ) : null}
      </div>
    </article>
  )
}
