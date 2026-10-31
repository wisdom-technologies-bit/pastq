import Link from 'next/link'
import { ArrowRight, ChartNoAxesColumnIncreasing } from 'lucide-react'
import { requireUser } from '@/lib/auth/session'
import { getProgressSummary, type SubjectSummary } from '@/lib/progress'
import { durationLabel, shortDate } from '@/lib/dates'
import { EmptyState } from '@/components/empty-state'
import { SessionRow, toneOf } from '@/components/progress/session-row'
import { ProgressTrend } from '@/components/progress/progress-trend'
import '@/components/progress/progress.css'

export const dynamic = 'force-dynamic'

const RING = 2 * Math.PI * 26

function SubjectLine({ entry, weak = false }: { entry: SubjectSummary; weak?: boolean }) {
  return (
    <li className="pg-subject">
      <div className="pg-subject-head">
        <span className="pg-subject-name">
          {entry.name}
          <small>{entry.exam_name}</small>
        </span>
        <span className="pg-subject-value">{entry.percent}%</span>
      </div>
      <div className="pg-bar" aria-hidden="true">
        <span style={{ width: `${Math.min(100, Math.max(0, entry.percent))}%` }} data-tone={toneOf(entry.percent)} />
      </div>
      <div className="pg-subject-foot">
        <span>
          {entry.correct} of {entry.total} correct
        </span>
        {weak && (
          <Link className="pg-text-link" href={`/practice/${entry.exam_slug}`}>
            Practise
          </Link>
        )}
      </div>
    </li>
  )
}

export default async function ProgressPage() {
  const { user } = await requireUser()
  const summary = await getProgressSummary(user.id)
  const { totals, streak, trend, exams, subjects, recent } = summary

  const header = (
    <header className="pg-head">
      <div>
        <p className="eyebrow">Progress</p>
        <h1>Progress</h1>
        <p className="pg-lede">Accuracy, streaks and the subjects worth another look.</p>
      </div>
      <Link className="pg-history-link" href="/progress/history">
        View history <ArrowRight size={15} />
      </Link>
    </header>
  )

  if (totals.sessions === 0) {
    return (
      <div className="pg-page">
        {header}
        <EmptyState
          icon={ChartNoAxesColumnIncreasing}
          eyebrow="Nothing to show yet"
          title="Your progress starts with one session."
          description="Finish a practice set or a CBT paper and the numbers, streak and subject breakdown appear here."
          action="Start practising"
          actionHref="/practice"
        />
      </div>
    )
  }

  const qualifying = [...subjects.strong, ...subjects.weak]
  const streakText = streak.current > 0 ? `${streak.current}-day streak` : 'Practise today to start a streak'

  return (
    <div className="pg-page">
      {header}

      <section className="pg-hero" aria-label="Overall accuracy">
        <div className="pg-hero-ring">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="26" className="pg-ring-track" />
            <circle
              cx="32"
              cy="32"
              r="26"
              className="pg-ring-fill"
              style={{ strokeDasharray: RING, strokeDashoffset: RING - (RING * Math.min(100, totals.accuracy)) / 100 }}
            />
          </svg>
          <span className="pg-hero-value">
            {totals.accuracy}
            <small>%</small>
          </span>
        </div>
        <div className="pg-hero-copy">
          <p className="pg-hero-label">Overall accuracy</p>
          <p className="pg-hero-meta">
            {totals.sessions} session{totals.sessions === 1 ? '' : 's'} · {durationLabel(totals.studySeconds)} studied
          </p>
          <span className={`pg-streak${streak.current > 0 ? '' : ' is-empty'}`}>{streakText}</span>
        </div>
      </section>

      <section className="pg-section">
        <h2 className="pg-section-title">This week</h2>
        <div className="pg-tiles">
          <div className="pg-tile">
            <strong>{totals.weekSessions}</strong>
            <span>Sessions</span>
          </div>
          <div className="pg-tile">
            <strong>{totals.weekAnswered}</strong>
            <span>Questions answered</span>
          </div>
          <div className="pg-tile">
            <strong>{durationLabel(totals.weekSeconds)}</strong>
            <span>Time studied</span>
          </div>
        </div>
      </section>

      {trend.length >= 3 && (
        <section className="pg-section">
          <h2 className="pg-section-title">Your last {trend.length} sessions</h2>
          <p className="pg-section-note">Percent per session. CBT sessions are drawn as rings.</p>
          <ProgressTrend points={trend} takeaway={summary.takeaway} />
        </section>
      )}

      {exams.length > 0 && (
        <section className="pg-section">
          <h2 className="pg-section-title">By exam</h2>
          <div className="pg-exams">
            {exams.map((exam) => (
              <article className="pg-exam" key={exam.slug}>
                <h3>{exam.name}</h3>
                <p className="pg-exam-meta">
                  {exam.sessions} session{exam.sessions === 1 ? '' : 's'} · last {shortDate(exam.lastAttempt)}
                </p>
                <dl className="pg-exam-stats">
                  <div>
                    <dt>Best</dt>
                    <dd>{exam.best}%</dd>
                  </div>
                  <div>
                    <dt>Average</dt>
                    <dd>{exam.average}%</dd>
                  </div>
                  {exam.bestScore400 !== null && (
                    <div>
                      <dt>Best score</dt>
                      <dd>{exam.bestScore400}/400</dd>
                    </div>
                  )}
                </dl>
              </article>
            ))}
          </div>
        </section>
      )}

      {qualifying.length > 0 && (
        <section className="pg-section">
          <h2 className="pg-section-title">Strengths and weak spots</h2>
          {subjects.combined ? (
            <ul className="pg-subjects">
              {subjects.weak.map((entry) => (
                <SubjectLine key={`${entry.exam_slug}-${entry.slug}`} entry={entry} weak={entry.percent < 50} />
              ))}
            </ul>
          ) : (
            <div className="pg-subject-columns">
              <div>
                <h3 className="pg-subtitle">Strongest</h3>
                <ul className="pg-subjects">
                  {subjects.strong.map((entry) => (
                    <SubjectLine key={`${entry.exam_slug}-${entry.slug}`} entry={entry} />
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="pg-subtitle">Needs work</h3>
                <ul className="pg-subjects">
                  {subjects.weak.map((entry) => (
                    <SubjectLine key={`${entry.exam_slug}-${entry.slug}`} entry={entry} weak />
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      )}

      {recent.length > 0 && (
        <section className="pg-section">
          <div className="pg-section-head">
            <h2 className="pg-section-title">Recent sessions</h2>
            <Link className="pg-text-link" href="/progress/history">
              See all
            </Link>
          </div>
          <div className="pg-rows">
            {recent.map((item) => (
              <SessionRow key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
