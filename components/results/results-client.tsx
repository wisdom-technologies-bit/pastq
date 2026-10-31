'use client'

import Link from 'next/link'
import { ArrowLeft, Clock3, LoaderCircle } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import type { StudySession } from '@/lib/study-sessions'
import type { ResultData, SubjectResult } from '@/lib/results'
import { BannerSlot } from '@/components/banners/BannerSlot'
import './results.css'

const pad = (value: number) => String(value).padStart(2, '0')
const clock = (seconds: number) => {
  const total = Math.max(0, Math.round(seconds || 0))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(total % 60)}` : `${minutes}:${pad(total % 60)}`
}
const seconds = (value: number) => {
  const total = Math.round(value)
  return total < 60 ? `${total} s` : `${Math.floor(total / 60)}m ${total % 60}s`
}
const headline = (percent: number) => (percent >= 90 ? 'Excellent' : percent >= 70 ? 'Strong work' : percent >= 50 ? 'Getting there' : 'Keep practising')
const tone = (percent: number) => (percent >= 70 ? 'success' : percent >= 50 ? 'accent' : 'danger')

export default function ResultsClient({
  session,
  result,
  failed,
  retake,
}: {
  session: StudySession
  result: ResultData | null
  failed: boolean
  retake: { missingCompulsory?: 'skip' | 'borrow'; subjects?: string[] }
}) {
  const [retrying, setRetrying] = useState(false)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')

  if (failed || !result) {
    return (
      <main className="rs-page">
        <section className="rs-error" role="alert">
          <h1>Results are unavailable</h1>
          <p>We couldn&apos;t load this result just now. Your session is safe, so try again.</p>
          <button
            className="primary-button"
            onClick={() => {
              setRetrying(true)
              location.reload()
            }}
            disabled={retrying}
          >
            {retrying ? 'Retrying…' : 'Retry'}
          </button>
        </section>
      </main>
    )
  }

  const data = result
  const percent = Math.max(0, Math.min(100, Math.round(data.percent || 0)))
  const practice = session.mode !== 'cbt'
  const jamb = data.score_400 !== null || data.subjects.some((subject) => typeof subject.score_100 === 'number')
  const autoSubmitted = session.status === 'expired' || Boolean(session.duration_seconds && data.time_used_seconds >= session.duration_seconds)
  const perQuestion = Math.round((data.time_used_seconds || 0) / Math.max(data.answered, 1))

  const ranked = data.subjects.filter((subject) => subject.total > 0)
  const best = ranked.length > 1 ? ranked.reduce((a, b) => (b.percent > a.percent ? b : a)) : null
  const worst = ranked.length > 1 ? ranked.reduce((a, b) => (b.percent < a.percent ? b : a)) : null
  const showBest = best && worst && best.percent !== worst.percent ? best : null

  async function again() {
    if (starting) return
    setStarting(true)
    setStartError('')
    const body = practice
      ? {
          mode: 'practice',
          exam: session.exam_slug,
          year: session.exam_year,
          subject: session.subject_slugs?.[0] ?? data.subjects[0]?.slug ?? '',
          count: session.total_questions || data.total,
          instantFeedback: session.feedback_mode === 'instant',
        }
      : {
          mode: 'cbt',
          exam: session.exam_slug,
          year: session.exam_year,
          subjects: retake.subjects ?? session.subject_slugs ?? [],
          ...(retake.missingCompulsory ? { missingCompulsory: retake.missingCompulsory } : {}),
        }
    try {
      const response = await fetch('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const payload = (await response.json().catch(() => ({}))) as { id?: string; error?: string }
      if (response.status === 401) {
        location.href = `/sign-in?next=${encodeURIComponent(location.pathname)}`
        return
      }
      if (!response.ok || !payload.id) {
        setStartError(payload.error ?? "We couldn't start that again. Please try again.")
        setStarting(false)
        return
      }
      location.href = `/practice/session/${payload.id}/play`
    } catch {
      setStartError("We couldn't reach PastQ. Check your connection and try again.")
      setStarting(false)
    }
  }

  return (
    <main className="rs-page">
      <header className="rs-header">
        <Link className="rs-back" href={`/practice/${session.exam_slug}/${session.exam_year}`} aria-label="Back to subjects">
          <ArrowLeft />
        </Link>
        <div>
          <p className="rs-eyebrow">Results</p>
          <h1 className="rs-title">
            {session.exam_name} {session.exam_year ?? ''}
          </h1>
        </div>
      </header>

      {data.total === 0 ? (
        <section className="rs-empty">
          <h2>Nothing to mark yet</h2>
          <p>This session doesn&apos;t have any recorded answers, so there is no score to show.</p>
          <Link className="primary-button" href={`/practice/${session.exam_slug}/${session.exam_year}`}>
            Back to {session.exam_name}
          </Link>
        </section>
      ) : (
        <>
          <section className="rs-hero">
            <div className="rs-ring-wrap">
              <svg className="rs-ring" viewBox="0 0 128 128" aria-hidden="true">
                <circle className="rs-ring-track" cx="64" cy="64" r="54" />
                <circle
                  className={`rs-ring-fill ${tone(percent)}`}
                  cx="64"
                  cy="64"
                  r="54"
                  style={{ '--p': percent } as CSSProperties}
                />
              </svg>
              <span className="rs-ring-label">
                {percent}
                <small>%</small>
              </span>
            </div>
            <div className="rs-hero-copy">
              <p className="rs-caps">
                {session.exam_name}
                {session.exam_year ? ` · ${session.exam_year}` : ''}
              </p>
              {data.score_400 !== null && (
                <p className="rs-score">
                  <strong>{data.score_400}</strong>
                  <span>/ 400</span>
                </p>
              )}
              <h2 className="rs-headline">{headline(percent)}</h2>
              <p className="rs-summary">
                {data.correct} of {data.total} correct in {clock(data.time_used_seconds)}
              </p>
              {autoSubmitted && (
                <p className="rs-auto">
                  <Clock3 size={13} /> Submitted automatically when time ran out
                </p>
              )}
            </div>
          </section>

          <section className="rs-tiles" aria-label="At a glance">
            <Tile label="Correct" value={data.correct} tone="success" />
            <Tile label="Wrong" value={data.wrong} tone="danger" />
            <Tile label="Unanswered" value={data.unanswered} tone="muted" note={practice ? 'includes revealed answers' : undefined} />
            <Tile label="Avg per question" value={seconds(perQuestion)} tone="muted" />
          </section>

          {(() => {
            const chips: Array<{ key: string; text: string; kind: string }> = []
            if (showBest) chips.push({ key: 'best', text: `Strongest: ${showBest.name} ${Math.round(showBest.percent)}%`, kind: 'strong' })
            if (showBest && worst) chips.push({ key: 'worst', text: `Needs work: ${worst.name} ${Math.round(worst.percent)}%`, kind: 'weak' })
            if (data.answered > 0 && data.answered < data.total)
              chips.push({ key: 'accuracy', text: `Accuracy ${Math.round((data.correct / data.answered) * 100)}% on questions you attempted`, kind: 'note' })
            if (data.unanswered > 0 && data.unanswered >= data.total * 0.1)
              chips.push({ key: 'unanswered', text: `You left ${data.unanswered} unanswered`, kind: 'note' })
            if (!chips.length) return null
            return (
              <ul className="rs-chips">
                {chips.map((chip) => (
                  <li key={chip.key} className={`rs-chip ${chip.kind}`}>
                    {chip.text}
                  </li>
                ))}
              </ul>
            )
          })()}

          <section className="rs-subjects">
            <h2>By subject</h2>
            <ul className="rs-subject-list">
              {data.subjects.map((subject) => {
                const pct = Math.max(0, Math.min(100, Math.round(subject.percent || 0)))
                const isBest = showBest?.slug === subject.slug
                const isWorst = best && worst && best.percent !== worst.percent && worst.slug === subject.slug
                return (
                  <li key={subject.slug} className="rs-subject">
                    <div className="rs-subject-head">
                      <span className="rs-subject-name">
                        {subject.name}
                        {isBest && <em className="rs-tag best">Highest</em>}
                        {isWorst && <em className="rs-tag worst">Lowest</em>}
                      </span>
                      <span className="rs-subject-value">
                        {jamb && typeof subject.score_100 === 'number' ? (
                          <strong>{Math.round(subject.score_100)}<small>/100</small></strong>
                        ) : (
                          <strong>
                            {pct}
                            <small>%</small>
                          </strong>
                        )}
                      </span>
                    </div>
                    <div className={`rs-bar ${tone(pct)}`} aria-hidden="true">
                      <span style={{ '--p': pct } as CSSProperties} />
                    </div>
                    <p className="rs-subject-count">
                      {subject.correct}/{subject.total} correct
                      {subject.unanswered > 0 ? ` · ${subject.unanswered} unanswered` : ''}
                    </p>
                  </li>
                )
              })}
            </ul>
          </section>

          <BannerSlot slot="results_bottom" />
        </>
      )}

      {data.total > 0 && (
        <div className="rs-actions">
          <div className="rs-actions-inner">
            {startError && (
              <p className="rs-action-error" role="alert">
                {startError}
              </p>
            )}
            <div className="rs-action-buttons">
              <Link className="primary-button" href={`/practice/session/${session.id}/review`}>
                Review answers
              </Link>
              <button className="rs-secondary" onClick={again} disabled={starting}>
                {starting ? (
                  <>
                    <LoaderCircle className="rs-spin" /> Starting…
                  </>
                ) : practice ? (
                  'Practise again'
                ) : (
                  'Retake exam'
                )}
              </button>
            </div>
            <Link className="rs-action-link" href={`/practice/${session.exam_slug}/${session.exam_year}`}>
              Back to {session.exam_name} {session.exam_year ?? ''}
            </Link>
          </div>
        </div>
      )}
    </main>
  )
}

function Tile({ label, value, tone: shade, note }: { label: string; value: number | string; tone: string; note?: string }) {
  return (
    <div className={`rs-tile ${shade}`}>
      <strong>{value}</strong>
      <small>{label}</small>
      {note && <em>{note}</em>}
    </div>
  )
}
