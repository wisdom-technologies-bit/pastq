'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, BookOpen, ChevronRight, Loader2, LockKeyhole, X } from 'lucide-react'
import type { ExamSubject } from '@/lib/bank/schemas'
import './setup-sheet.css'

type Limits = { min: number; max: number }

type RowProps = {
  subject: ExamSubject
  exam: string
  examName: string
  year: number
  compulsory: boolean
  signedIn: boolean
  locked: boolean
  limits: Limits
  defaultInstant: boolean
}

function Sheet({ labelId, onClose, children }: { labelId: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div
      className="ps-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className="ps-sheet" role="dialog" aria-modal="true" aria-labelledby={labelId}>
        <div className="ps-grabber" aria-hidden="true" />
        <button type="button" className="ps-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        {children}
      </section>
    </div>,
    document.body,
  )
}

export function UnlockSheet({ signedIn, returnPath, onClose }: { signedIn: boolean; returnPath: string; onClose: () => void }) {
  return (
    <Sheet labelId="ps-unlock-title" onClose={onClose}>
      <div className="ps-mark">
        <LockKeyhole size={22} />
      </div>
      <h2 id="ps-unlock-title" className="ps-title">Unlock every year</h2>
      <p className="ps-sub">This year needs activation. Go further with the full PastQ archive.</p>
      <ul className="ps-list">
        <li>All years of every exam</li>
        <li>CBT practice for every year</li>
        <li>Full history across your subjects</li>
      </ul>
      <div className="ps-actions">
        <Link
          className="primary-button"
          href={signedIn ? '/plans' : `/sign-in?next=${encodeURIComponent(returnPath)}`}
          onClick={onClose}
        >
          {signedIn ? 'Activate premium' : 'Sign in to continue'} <ArrowRight size={16} />
        </Link>
        <button type="button" className="text-button ps-cancel" onClick={onClose}>Not now</button>
      </div>
    </Sheet>
  )
}

function SetupSheet({
  subject,
  exam,
  examName,
  year,
  limits,
  defaultInstant,
  returnPath,
  onClose,
}: {
  subject: ExamSubject
  exam: string
  examName: string
  year: number
  limits: Limits
  defaultInstant: boolean
  returnPath: string
  onClose: () => void
}) {
  const router = useRouter()
  const cap = Math.min(subject.published_count, limits.max)
  const options = useMemo(
    () =>
      Array.from(new Set([10, 20, subject.default_question_count, cap]))
        .filter((n) => n >= limits.min && n <= cap)
        .sort((a, b) => a - b),
    [cap, limits.min, subject.default_question_count],
  )
  const [count, setCount] = useState<number>(() => (options.includes(20) ? 20 : options[options.length - 1] ?? 0))
  const [instant, setInstant] = useState(defaultInstant)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; code?: string } | null>(null)

  const chipLabel = (n: number) => (n === cap ? (subject.published_count <= limits.max ? `All ${n}` : `${n} (max)`) : String(n))

  async function start() {
    if (busy || count < limits.min) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'practice', exam, year, subject: subject.slug, count, instantFeedback: instant }),
      })
      const body = (await response.json().catch(() => ({}))) as { id?: string; error?: string; code?: string }
      if (response.status === 401) {
        router.push(`/sign-in?next=${encodeURIComponent(returnPath)}`)
        return
      }
      if (!response.ok || !body.id) {
        setError({ message: body.error ?? 'Something went wrong. Please try again.', code: body.code })
        setBusy(false)
        return
      }
      router.push(`/practice/session/${body.id}`)
    } catch {
      setError({ message: 'We could not reach PastQ. Check your connection and try again.' })
      setBusy(false)
    }
  }

  return (
    <Sheet labelId="ps-setup-title" onClose={onClose}>
      <p className="ps-kicker">Practice</p>
      <h2 id="ps-setup-title" className="ps-title">{subject.name}</h2>
      <p className="ps-sub">{examName} · {year}</p>

      {options.length === 0 ? (
        <p className="ps-error" role="alert">There are not enough questions in this subject to start a session yet.</p>
      ) : (
        <>
          <p className="ps-label">How many questions?</p>
          <div className="ps-chips" role="radiogroup" aria-label="Number of questions">
            {options.map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={count === n}
                className={`ps-chip${count === n ? ' selected' : ''}`}
                onClick={() => setCount(n)}
              >
                {chipLabel(n)}
              </button>
            ))}
          </div>
          {subject.passage_count > 0 && (
            <p className="ps-note">Includes passage questions. Passages stay together, so the total can be a few more than you pick.</p>
          )}

          <div className="ps-toggle">
            <span>
              <strong>Show the answer right after I choose</strong>
              <small>Turn off to see all answers at the end.</small>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={instant}
              aria-label="Show the answer right after I choose"
              className={`settings-switch${instant ? ' on' : ''}`}
              onClick={() => setInstant((value) => !value)}
            >
              <span />
            </button>
          </div>
        </>
      )}

      {error && (
        <div className="ps-error" role="alert">
          <p>{error.message}</p>
          {error.code === 'premium_required' && <Link href="/plans" onClick={onClose}>See plans</Link>}
          {error.code === 'too_many_active_sessions' && <Link href="/practice" onClick={onClose}>See your open sessions</Link>}
        </div>
      )}

      <div className="ps-actions">
        <button type="button" className="primary-button" onClick={start} disabled={busy || options.length === 0}>
          {busy ? <><Loader2 size={18} className="ps-spin" /> Starting…</> : <>Start practice <ArrowRight size={16} /></>}
        </button>
        <button type="button" className="text-button ps-cancel" onClick={onClose} disabled={busy}>Cancel</button>
      </div>
    </Sheet>
  )
}

export function SubjectSetupRow({ subject, exam, examName, year, compulsory, signedIn, locked, limits, defaultInstant }: RowProps) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const returnPath = `/practice/${exam}/${year}?subject=${encodeURIComponent(subject.slug)}&start=1`

  useEffect(() => {
    if (signedIn && !locked && params.get('start') === '1' && params.get('subject') === subject.slug) {
      setOpen(true)
      router.replace(pathname, { scroll: false })
    }
  }, [params, pathname, router, signedIn, locked, subject.slug])

  const body = (
    <>
      <span className="subject-chip"><BookOpen size={16} /></span>
      <div>
        <strong>{subject.name} {compulsory && <span className="status-pill">Compulsory</span>}</strong>
        <span>{subject.published_count} questions {subject.passage_count > 0 && <span className="status-pill">Includes passages</span>}</span>
      </div>
      {locked ? <LockKeyhole className="subject-chevron" size={18} /> : <ChevronRight className="subject-chevron" />}
    </>
  )

  if (!signedIn) {
    return <Link href={`/sign-in?next=${encodeURIComponent(returnPath)}`} className="subject-row">{body}</Link>
  }

  return (
    <>
      <button type="button" className="subject-row" onClick={() => setOpen(true)}>{body}</button>
      {open && (locked
        ? <UnlockSheet signedIn={signedIn} returnPath={`/practice/${exam}/${year}`} onClose={close} />
        : <SetupSheet subject={subject} exam={exam} examName={examName} year={year} limits={limits} defaultInstant={defaultInstant} returnPath={returnPath} onClose={close} />)}
    </>
  )
}
