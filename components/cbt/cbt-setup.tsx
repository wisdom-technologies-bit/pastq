'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ArrowRight, Check, Clock3, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react'
import { UnlockSheet } from '@/components/browse/practice-setup'
import './cbt-setup.css'

export type SetupSubject = { slug: string; name: string; publishedCount: number; questionCount: number }

export type CbtSetupProps = {
  exam: string
  examName: string
  year: number
  signedIn: boolean
  activated: boolean
  subjects: SetupSubject[]
  compulsorySlug: string | null
  compulsoryName: string
  compulsoryCount: number
  missing: boolean
  missingName: string
  borrow: { available: boolean; donorYear: number | null; requiresActivation: boolean } | null
  minSubjects: number
  maxSubjects: number
  subjectsRequired: number
  sharedTimer: boolean
  totalMinutes: number | null
  defaultMinutes: number
  scoredOutOf400: boolean
  nextPath: string
}

type BorrowMode = 'skip' | 'borrow'

const MESSAGES: Record<string, string> = {
  premium_required: 'This year needs premium. Activate your account to sit this CBT.',
  compulsory_subject_required: 'The compulsory subject is required for this exam.',
  compulsory_subject_missing: 'The compulsory subject is not available for this year yet.',
  invalid_config: 'That setup is not available. Adjust your subjects and try again.',
  not_enough_questions: 'There are not enough questions for that selection yet.',
  too_many_active_sessions: 'You have 5 sessions open. Finish or leave one first.',
  unauthorized: 'Your session expired. Sign in again to continue.',
  bank_unavailable: 'PastQ is taking a short break. Please try again in a moment.',
}

export function CbtSetup(props: CbtSetupProps) {
  const router = useRouter()
  const showBorrow = props.missing && Boolean(props.borrow?.available)
  const [borrowMode, setBorrowMode] = useState<BorrowMode>('skip')
  const [chosen, setChosen] = useState<string[]>(() => (props.missing || !props.compulsorySlug ? [] : [props.compulsorySlug]))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; code?: string } | null>(null)
  const [unlock, setUnlock] = useState(false)

  const borrowing = borrowMode === 'borrow'
  const selected = useMemo(() => new Set(chosen), [chosen])
  const count = chosen.length + (borrowing ? 1 : 0)
  const full = count >= props.maxSubjects
  const valid = count >= props.minSubjects && count <= props.maxSubjects

  const questionTotal = useMemo(() => {
    const own = props.subjects.reduce((sum, subject) => (selected.has(subject.slug) ? sum + subject.questionCount : sum), 0)
    return own + (borrowing ? props.compulsoryCount : 0)
  }, [props.subjects, props.compulsoryCount, selected, borrowing])

  const minutes = props.sharedTimer ? props.totalMinutes ?? props.defaultMinutes : props.defaultMinutes * Math.max(1, count)
  const single = props.subjectsRequired === 1 || props.maxSubjects <= 1
  const capacity = props.maxSubjects - (borrowing ? 1 : 0)

  const counter = single ? (count === 1 ? '1 chosen' : 'Choose one') : `${count} of ${props.maxSubjects} chosen`

  function toggle(slug: string) {
    if (busy) return
    if (slug === props.compulsorySlug && !props.missing) return
    setError(null)
    setChosen((current) => {
      if (current.includes(slug)) return current.filter((item) => item !== slug)
      if (current.length >= capacity) return single ? [slug] : current
      return [...current, slug]
    })
  }

  function chooseBorrow() {
    if (busy || borrowMode === 'borrow') return
    if (props.borrow?.requiresActivation && !props.activated) {
      setUnlock(true)
      return
    }
    setError(null)
    setBorrowMode('borrow')
    setChosen((current) => current.slice(0, Math.max(0, props.maxSubjects - 1)))
  }

  async function start() {
    if (busy || !valid) return
    if (!props.signedIn) {
      router.push(`/sign-in?next=${encodeURIComponent(props.nextPath)}`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'cbt',
          exam: props.exam,
          year: props.year,
          subjects: chosen,
          missingCompulsory: props.missing ? borrowMode : undefined,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.id) {
        const code = typeof body?.code === 'string' ? body.code : ''
        setError({ message: MESSAGES[code] ?? MESSAGES.bank_unavailable, code })
        setBusy(false)
        return
      }
      router.push(`/practice/session/${body.id}/play`)
    } catch {
      setError({ message: MESSAGES.bank_unavailable })
      setBusy(false)
    }
  }

  const lockedCompulsory = !props.missing && Boolean(props.compulsorySlug)

  return (
    <div className="cbt-setup">
      <header className="cbt-setup-head">
        <p className="eyebrow">Computer based test</p>
        <h1>
          CBT · {props.examName} {props.year}
        </h1>
        <p className="lede">
          {single
            ? 'Sit one timed subject. The clock starts when you press start.'
            : `Pick ${props.minSubjects === props.maxSubjects ? props.maxSubjects : `${props.minSubjects} to ${props.maxSubjects}`} subjects, then sit the paper under exam timing.`}
        </p>
      </header>

      <section className="cbt-card" aria-labelledby="cbt-subjects-title">
        <div className="cbt-card-head">
          <div>
            <h2 id="cbt-subjects-title">Choose your subjects</h2>
            <p className="cbt-hint">The compulsory subject is always included.</p>
          </div>
          <span className="cbt-counter" aria-live="polite">
            {counter}
          </span>
        </div>

        <ul className="cbt-subject-list">
          {lockedCompulsory && (
            <li className="cbt-subject-item">
              <span className="cbt-subject-row locked" aria-label={`${props.compulsoryName}, required`}>
                <span className="cbt-check on" aria-hidden="true">
                  <Check size={14} />
                </span>
                <span className="cbt-subject-copy">
                  <strong>{props.compulsoryName}</strong>
                  <small>
                    {props.compulsoryCount} questions · <b>Required</b>
                  </small>
                </span>
                {!props.activated && <LockKeyhole className="cbt-subject-lock" size={15} aria-hidden="true" />}
              </span>
            </li>
          )}

          {borrowing && (
            <li className="cbt-subject-item">
              <span className="cbt-subject-row locked" aria-label={`${props.missingName}, borrowed from ${props.borrow?.donorYear}`}>
                <span className="cbt-check on" aria-hidden="true">
                  <Check size={14} />
                </span>
                <span className="cbt-subject-copy">
                  <strong>{props.missingName}</strong>
                  <small>
                    {props.compulsoryCount} questions · Borrowed from {props.borrow?.donorYear}
                  </small>
                </span>
                {!props.activated && <LockKeyhole className="cbt-subject-lock" size={15} aria-hidden="true" />}
              </span>
            </li>
          )}

          {props.subjects
            .filter((subject) => !lockedCompulsory || subject.slug !== props.compulsorySlug)
            .map((subject) => {
              const isSelected = selected.has(subject.slug)
              const blocked = !isSelected && full
              return (
                <li className="cbt-subject-item" key={subject.slug}>
                  <button
                    type="button"
                    className={`cbt-subject-row${isSelected ? ' selected' : ''}${blocked ? ' dim' : ''}`}
                    aria-pressed={isSelected}
                    aria-disabled={blocked}
                    onClick={() => (blocked ? undefined : toggle(subject.slug))}
                  >
                    <span className={`cbt-check${isSelected ? ' on' : ''}`} aria-hidden="true">
                      {isSelected ? <Check size={14} /> : null}
                    </span>
                    <span className="cbt-subject-copy">
                      <strong>{subject.name}</strong>
                      <small>{subject.questionCount} questions</small>
                    </span>
                  </button>
                </li>
              )
            })}
        </ul>

        {props.subjects.length === 0 && !props.missing && <p className="cbt-hint">No subjects are ready for this year yet.</p>}
      </section>

      {props.missing && (
        <section className="cbt-card" aria-labelledby="cbt-missing-title">
          <h2 id="cbt-missing-title">{props.missingName} is not available for {props.year} yet</h2>
          <p className="cbt-hint">Choose how you want to sit this paper.</p>
          <div className="cbt-choice" role="radiogroup" aria-labelledby="cbt-missing-title">
            <button
              type="button"
              role="radio"
              aria-checked={!borrowing}
              className={`cbt-choice-row${!borrowing ? ' selected' : ''}`}
              onClick={() => {
                if (busy) return
                setError(null)
                setBorrowMode('skip')
              }}
            >
              <span className={`cbt-check${!borrowing ? ' on' : ''}`} aria-hidden="true">
                {!borrowing ? <Check size={14} /> : null}
              </span>
              <span className="cbt-subject-copy">
                <strong>Continue without {props.missingName}</strong>
                <small>You will sit the subjects you choose.</small>
              </span>
            </button>
            {showBorrow && (
              <button
                type="button"
                role="radio"
                aria-checked={borrowing}
                className={`cbt-choice-row${borrowing ? ' selected' : ''}`}
                onClick={chooseBorrow}
              >
                <span className={`cbt-check${borrowing ? ' on' : ''}`} aria-hidden="true">
                  {borrowing ? <Check size={14} /> : null}
                </span>
                <span className="cbt-subject-copy">
                  <strong>Borrow it from {props.borrow?.donorYear}</strong>
                  <small>Uses past questions from another year.</small>
                </span>
              </button>
            )}
          </div>
        </section>
      )}

      <section className="cbt-card cbt-expect" aria-labelledby="cbt-expect-title">
        <h2 id="cbt-expect-title">What to expect</h2>
        <ul>
          <li>
            <Clock3 size={16} aria-hidden="true" /> The timer cannot be paused or reset.
          </li>
          <li>
            <Check size={16} aria-hidden="true" /> Answers save automatically as you go.
          </li>
          <li>
            <ShieldCheck size={16} aria-hidden="true" /> No answers are shown until you submit.
          </li>
          <li>
            <ArrowRight size={16} aria-hidden="true" /> The exam submits itself when time is up.
          </li>
          {props.scoredOutOf400 && <li className="cbt-expect-note">Scored out of 400.</li>}
        </ul>
      </section>

      {error && (
        <p className="cbt-error" role="alert">
          {error.message}
          {error.code === 'premium_required' && (
            <>
              {' '}
              <Link className="text-link" href={`/plans?next=${encodeURIComponent(props.nextPath)}`}>
                See plans
              </Link>
            </>
          )}
        </p>
      )}

      <div className="cbt-summary">
        <div className="cbt-summary-inner">
          <div className="cbt-summary-copy">
            <strong>
              {questionTotal} questions · {minutes} min
            </strong>
            <small>{count > 0 ? `${count} subject${count === 1 ? '' : 's'} selected` : 'No subjects selected yet'}</small>
          </div>
          <button type="button" className="primary-button cbt-start" onClick={start} disabled={!valid || busy}>
            {busy ? (
              <>
                <Loader2 className="cbt-spin" size={16} aria-hidden="true" /> Starting…
              </>
            ) : props.signedIn ? (
              <>
                Start CBT <ArrowRight size={16} aria-hidden="true" />
              </>
            ) : (
              <>
                Sign in to start <ArrowRight size={16} aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>

      {unlock && <UnlockSheet signedIn={props.signedIn} returnPath={props.nextPath} onClose={() => setUnlock(false)} />}
    </div>
  )
}
