'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Flag, Grid2X2, Loader2, Menu, ZoomIn } from 'lucide-react'
import { normalizeQuestion, type PlayerMeta, type Question } from './types'
import './cbt-player.css'

const PAGE_SIZE = 30
const MARKS = [600000, 300000, 60000]
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type SubjectGroup = { name: string; start: number; count: number }
type SessionState = {
  status: string
  deadline_at: string | null
  server_now: string
  answered: number
  total: number
  flagged: number
  subjects: Array<{ slug: string; name: string; question_count: number; first_position: number }>
}

const clockText = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`
}

export default function CbtPlayer({ meta }: { meta: PlayerMeta }) {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const search = useSearchParams()

  const [questions, setQuestions] = useState<Question[]>([])
  const [total, setTotal] = useState(meta.total_questions || 0)
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [session, setSession] = useState<SessionState | null>(null)
  const [answered, setAnswered] = useState(0)
  const [flagged, setFlagged] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [queueSize, setQueueSize] = useState(0)
  const [offline, setOffline] = useState(false)
  const [palette, setPalette] = useState(false)
  const [menu, setMenu] = useState(false)
  const [leave, setLeave] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [submitPrep, setSubmitPrep] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [size, setSize] = useState<'small' | 'medium' | 'large'>('medium')
  const [zoom, setZoom] = useState<string | null>(null)
  const [timeUp, setTimeUp] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [toasts, setToasts] = useState<Array<{ id: number; text: string }>>([])

  const offset = useRef(0)
  const primed = useRef(false)
  const fired = useRef<Set<number>>(new Set())
  const questionsRef = useRef<Question[]>([])
  const totalRef = useRef(total)
  const pending = useRef<number | null>(null)
  const seeded = useRef(false)
  const busy = useRef(false)
  const navigating = useRef(false)
  const queue = useRef(new Map<string, { choice?: string | null; flagged?: boolean }>())
  const toastId = useRef(0)
  const heading = useRef<HTMLHeadingElement>(null)

  const q = questions[index]

  useEffect(() => {
    questionsRef.current = questions
  }, [questions])
  useEffect(() => {
    totalRef.current = total
  }, [total])

  const deadline = session?.deadline_at ? new Date(session.deadline_at).getTime() : null
  const remaining = deadline === null ? null : Math.max(0, deadline - (now + offset.current))
  const locked = timeUp || session?.status === 'submitted' || session?.status === 'expired'

  /* Only tick once a deadline is known: the value is always recomputed from the
     corrected clock, never decremented, so sleeping tabs stay accurate. */
  useEffect(() => {
    if (deadline === null) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [deadline])

  const pushToast = useCallback((text: string) => {
    const stamp = ++toastId.current
    setToasts((items) => [...items, { id: stamp, text }])
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== stamp)), 6000)
  }, [])

  /* --------------------------------------------------------------- saving */
  const syncQueue = useCallback(() => setQueueSize(queue.current.size), [])

  const persist = useCallback(
    async (question: Question, intent: { choice?: string | null; flagged?: boolean }) => {
      try {
        const response = await fetch(`/api/sessions/${id}/answers`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: [{ ref: question.ref, ...intent }] }),
        })
        if (response.ok) {
          queue.current.delete(question.ref)
          syncQueue()
          setOffline(false)
          setError('')
          return true
        }
        if (response.status >= 500) {
          queue.current.set(question.ref, { ...queue.current.get(question.ref), ...intent })
          syncQueue()
          setOffline(true)
          return false
        }
        queue.current.delete(question.ref)
        syncQueue()
        setError('We could not save that answer. Please try again.')
        return false
      } catch {
        queue.current.set(question.ref, { ...queue.current.get(question.ref), ...intent })
        syncQueue()
        setOffline(true)
        return false
      }
    },
    [id, syncQueue],
  )

  const flush = useCallback(
    async (timeoutMs = 10000) => {
      if (!queue.current.size) return true
      const work = (async () => {
        for (const ref of Array.from(queue.current.keys())) {
          const intent = queue.current.get(ref)
          if (!intent) {
            queue.current.delete(ref)
            continue
          }
          const item = questionsRef.current.find((question) => question.ref === ref)
          // Keep the intent rather than dropping a student's answer.
          if (!item) continue
          const saved = await persist(item, intent)
          if (!saved) break
        }
      })()
      await Promise.race([work, delay(timeoutMs)])
      syncQueue()
      return queue.current.size === 0
    },
    [persist, syncQueue],
  )

  useEffect(() => {
    if (!queueSize) return
    const timer = window.setInterval(() => {
      if (navigator.onLine) void flush()
    }, 5000)
    return () => window.clearInterval(timer)
  }, [queueSize, flush])

  /* ------------------------------------------------------------- session */
  const refreshState = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${id}/state`, { cache: 'no-store' })
      if (!response.ok) return
      const data = (await response.json()) as SessionState
      const serverNow = new Date(data.server_now).getTime()
      if (Number.isFinite(serverNow)) offset.current = serverNow - Date.now()
      setSession(data)
      if (data.status === 'submitted' || data.status === 'expired') {
        router.replace(`/practice/session/${id}/result`)
        return
      }
      if (!seeded.current) {
        seeded.current = true
        setAnswered(data.answered)
        setFlagged(data.flagged)
      }
      if (data.total > 0) setTotal((value) => (value > 0 ? value : data.total))
    } catch {
      /* keep the last known clock and try again on the next tick */
    }
  }, [id, router])

  useEffect(() => {
    void refreshState()
    const timer = window.setInterval(() => void refreshState(), 60000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshState()
    }
    const onOnline = () => {
      setOffline(false)
      void refreshState()
      void flush()
    }
    const onOffline = () => setOffline(true)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [refreshState, flush])

  /* ------------------------------------------------------------ questions */
  const loadPage = useCallback(
    async (from: number, append: boolean): Promise<Question[]> => {
      if (append) setLoadingMore(true)
      else setLoading(true)
      try {
        const response = await fetch(`/api/sessions/${id}/questions?from=${from}&limit=${PAGE_SIZE}`, { cache: 'no-store' })
        if (!response.ok) throw new Error('failed')
        const body = await response.json()
        const rows: unknown[] = Array.isArray(body?.data) ? body.data : Array.isArray(body?.data?.items) ? body.data.items : []
        const list: Question[] = []
        rows.forEach((row, position) => {
          const item = normalizeQuestion(row, from - 1 + position)
          if (item) list.push(item)
        })
        const remoteTotal = Number(body?.meta?.total_questions ?? body?.meta?.total ?? body?.total_questions ?? body?.total ?? 0)
        setQuestions((old) => (append ? [...old, ...list.filter((item) => !old.some((existing) => existing.ref === item.ref))] : list))
        if (remoteTotal > 0) setTotal(remoteTotal)
        setError('')
        return list
      } catch {
        setError("We couldn't load this question. Check your connection and try again.")
        return []
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [id],
  )

  const wantedParam = search.get('q') ?? ''
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const list = await loadPage(1, false)
      if (cancelled || !list.length) return
      const wanted = Number(wantedParam || 0)
      const target = wanted ? list.findIndex((item) => item.number === wanted) : list.findIndex((item) => !item.your_choice)
      setIndex(Math.max(0, target < 0 ? 0 : target))
    })()
    return () => {
      cancelled = true
    }
  }, [loadPage, wantedParam])

  useEffect(() => {
    if (loading || loadingMore) return
    if (!total || questions.length >= total) return
    if (index >= questions.length - 3) void loadPage(questions.length + 1, true)
  }, [index, questions.length, total, loading, loadingMore, loadPage])

  useEffect(() => {
    const target = pending.current
    if (target === null) return
    const found = questions.findIndex((item) => item.number === target)
    if (found >= 0) {
      pending.current = null
      setIndex(found)
    }
  }, [questions])

  const ensureAll = useCallback(async () => {
    let loaded = questionsRef.current.length
    const limit = Math.max(totalRef.current, loaded)
    let guard = 0
    while (loaded < limit && guard < 25) {
      const added = await loadPage(loaded + 1, true)
      if (!added.length) break
      loaded += added.length
      guard++
    }
  }, [loadPage])

  const goTo = useCallback(
    async (number: number) => {
      if (number < 1) return
      const loaded = questionsRef.current.findIndex((item) => item.number === number)
      if (loaded >= 0) {
        setIndex(loaded)
        return
      }
      pending.current = number
      let count = questionsRef.current.length
      const limit = Math.max(totalRef.current, number)
      let guard = 0
      while (count < limit && guard < 25) {
        const added = await loadPage(count + 1, true)
        if (!added.length) break
        count += added.length
        guard++
      }
      if (pending.current === number) pending.current = null
    },
    [loadPage],
  )

  const jump = useCallback((number: number) => void goTo(number), [goTo])
  const jumpFromSheet = useCallback(
    (number: number) => {
      setPalette(false)
      void goTo(number)
    },
    [goTo],
  )

  /* --------------------------------------------------------------- answering */
  const choose = (key: string) => {
    if (!q || locked) return
    const previous = q.your_choice ?? null
    const next = previous === key ? null : key
    const ref = q.ref
    setQuestions((items) => items.map((item) => (item.ref === ref ? { ...item, your_choice: next } : item)))
    setAnswered((value) => Math.max(0, value + (next ? 1 : 0) - (previous ? 1 : 0)))
    void persist(q, { choice: next })
  }

  const toggleFlag = () => {
    if (!q || locked) return
    const next = !q.flagged
    const ref = q.ref
    setQuestions((items) => items.map((item) => (item.ref === ref ? { ...item, flagged: next } : item)))
    setFlagged((value) => Math.max(0, value + (next ? 1 : -1)))
    void persist(q, { flagged: next })
  }

  /* ---------------------------------------------------------------- submit */
  const submitExam = useCallback(
    async (auto: boolean) => {
      if (busy.current) return
      busy.current = true
      setSubmitting(true)
      setSubmitError('')
      try {
        await flush(auto ? 5000 : 10000)
        const attempts = auto ? 4 : 1
        for (let attempt = 1; attempt <= attempts; attempt++) {
          try {
            const response = await fetch(`/api/sessions/${id}/submit`, { method: 'POST' })
            if (response.ok) {
              navigating.current = true
              router.replace(`/practice/session/${id}/result`)
              return
            }
            const body = await response.json().catch(() => null)
            setSubmitError(
              body && typeof body.error === 'string' ? body.error : 'We could not submit your exam. Please try again.',
            )
          } catch {
            setSubmitError('We could not reach PastQ. Check your connection and try again.')
          }
          if (attempt < attempts) await delay(1500)
        }
      } finally {
        busy.current = false
        if (!navigating.current) setSubmitting(false)
      }
    },
    [flush, id, router],
  )

  /* -------------------------------------------------- thresholds + time up */
  useEffect(() => {
    if (remaining === null) return
    const first = !primed.current
    if (first) {
      // Opening a session that is already under a threshold must not replay it.
      primed.current = true
      for (const mark of MARKS) if (remaining <= mark - 1000) fired.current.add(mark)
    }
    if (remaining <= 0) {
      if (timeUp) return
      setTimeUp(true)
      setSubmitOpen(false)
      setMenu(false)
      setPalette(false)
      void submitExam(true)
      return
    }
    if (first) return
    for (const mark of MARKS) {
      if (remaining > mark || fired.current.has(mark)) continue
      fired.current.add(mark)
      const minutes = mark / 60000
      const text = `${minutes} minute${minutes === 1 ? '' : 's'} left`
      pushToast(text)
      setAnnounce(text)
    }
  }, [remaining, timeUp, submitExam, pushToast])

  /* ------------------------------------------------------------ shortcuts */
  useEffect(() => {
    if (locked) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [locked])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (timeUp || palette || menu || leave || submitOpen || zoom) return
      const key = event.key.toLowerCase()
      const option = q?.options?.find((item) => item.key.toLowerCase() === key)
      if (option) {
        event.preventDefault()
        choose(option.key)
        return
      }
      if (key === 'n') {
        event.preventDefault()
        void goTo((q?.number ?? 0) + 1)
      } else if (key === 'p') {
        event.preventDefault()
        void goTo((q?.number ?? 1) - 1)
      } else if (key === 'f') {
        event.preventDefault()
        toggleFlag()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    heading.current?.focus()
  }, [q?.ref])

  /* ----------------------------------------------------------------- views */
  const groups = useMemo<SubjectGroup[]>(() => {
    const fromServer = (session?.subjects ?? []).filter((subject) => subject.question_count > 0)
    if (fromServer.length) {
      return fromServer.map((subject) => ({ name: subject.name, start: subject.first_position, count: subject.question_count }))
    }
    const buckets = new Map<string, number[]>()
    for (const item of questions) {
      const key = item.subject || 'Questions'
      const bucket = buckets.get(key) ?? []
      bucket.push(item.number)
      buckets.set(key, bucket)
    }
    return Array.from(buckets, ([name, numbers]) => ({ name, start: Math.min(...numbers), count: numbers.length }))
  }, [session, questions])

  const status = useMemo(() => {
    const map = new Map<number, { answered: boolean; flagged: boolean }>()
    for (const item of questions) map.set(item.number, { answered: Boolean(item.your_choice), flagged: Boolean(item.flagged) })
    return map
  }, [questions])

  // Once every question is loaded the counts are exact, so align them with the
  // answers the Bank returned instead of the running tally.
  useEffect(() => {
    if (!questions.length || questions.length < (total || 0)) return
    setAnswered(questions.filter((item) => item.your_choice).length)
    setFlagged(questions.filter((item) => item.flagged).length)
  }, [questions, total])

  const questionTotal = total || meta.total_questions || questions.length
  const unanswered = Math.max(0, questionTotal - answered)
  const currentSubject = (() => {
    if (!q) return ''
    const group = groups.find((item) => q.number >= item.start && q.number < item.start + item.count)
    return group?.name ?? q.subject ?? ''
  })()
  const passage = q?.passage ?? ''
  const questionImage = q?.image_url ?? null
  const chips = questions.filter((item) => !item.your_choice || item.flagged).map((item) => item.number)
  const tone = remaining !== null && remaining <= 300000 ? 'danger' : remaining !== null && remaining <= 600000 ? 'warn' : ''
  const title = `${meta.exam_name}${meta.exam_year ? ` ${meta.exam_year}` : ''}`

  const openSubmit = async () => {
    setMenu(false)
    setSubmitError('')
    setSubmitOpen(true)
    setSubmitPrep(true)
    await ensureAll()
    setSubmitPrep(false)
  }

  if (loading && !q)
    return (
      <main className="player-page player-focus">
        <div className="player-skeleton" />
        <div className="player-skeleton short" />
      </main>
    )
  if (error && !q)
    return (
      <main className="player-page player-centered">
        <h1>We couldn&apos;t load this right now</h1>
        <p>{error}</p>
        <button className="primary-button" onClick={() => void loadPage(1, false)}>Retry</button>
      </main>
    )
  if (!q) return null

  return (
    <main className="player-page player-focus">
      <header className="player-top cbt-top">
        <button className="icon-button" aria-label="Leave exam" onClick={() => setLeave(true)}>
          <ArrowLeft />
        </button>
        <div className="cbt-title">
          <strong>{title}</strong>
          <small>{currentSubject || meta.subject_names.join(' · ')}</small>
        </div>
        {remaining !== null && (
          <span className={`cbt-timer ${tone}`} role="timer" aria-label="Time remaining">
            {clockText(remaining)}
          </span>
        )}
        <button className="icon-button" aria-label="Exam menu" onClick={() => setMenu(true)}>
          <Menu />
        </button>
      </header>

      {groups.length > 1 && (
        <div className="cbt-subjects" role="tablist" aria-label="Subjects">
          {groups.map((group) => (
            <button
              key={`${group.name}-${group.start}`}
              role="tab"
              aria-selected={currentSubject === group.name}
              className={`cbt-subject ${currentSubject === group.name ? 'active' : ''}`}
              onClick={() => void goTo(group.start)}
            >
              {group.name}
            </button>
          ))}
        </div>
      )}

      <div className="player-progress">
        <span style={{ width: `${questionTotal ? Math.min(100, (answered / questionTotal) * 100) : 0}%` }} />
      </div>
      <div className="cbt-meter">
        <span>Question {q.number} of {questionTotal}</span>
        <span>{answered} answered</span>
      </div>

      <p className="sr-announce" aria-live="polite">{announce}</p>
      {queueSize > 0 && (
        <div className="offline-banner" role="status">
          {offline ? "You're offline. Your answers will save when you're back." : 'Saving your answers…'}
        </div>
      )}
      {error && <div className="offline-banner" role="status">{error}</div>}

      <div className="player-layout">
        <section className="question-wrap">
          <p className="question-label">Question {q.number}</p>
          <h1
            ref={heading}
            tabIndex={-1}
            className="question-text"
            style={{ fontSize: size === 'small' ? 16 : size === 'large' ? 21 : 18 }}
            dangerouslySetInnerHTML={{ __html: q.text }}
          />
          {passage && (
            <article className="passage-card">
              <small>Passage</small>
              <div dangerouslySetInnerHTML={{ __html: passage }} />
            </article>
          )}
          {questionImage && (
            <button className="question-image-wrap" onClick={() => setZoom(questionImage)} aria-label="Zoom question image">
              <img
                className="question-image"
                loading="lazy"
                src={questionImage}
                alt={`Diagram for question ${q.number}`}
                onError={(event) => {
                  event.currentTarget.style.display = 'none'
                }}
              />
              <ZoomIn size={18} />
            </button>
          )}

          <div className="question-actions">
            <span>{q.your_choice ? 'Tap your answer again to clear it' : 'Choose one answer'}</span>
            <button
              className={`flag-button ${q.flagged ? 'active' : ''}`}
              onClick={toggleFlag}
              aria-label={q.flagged ? 'Remove flag' : 'Flag for review'}
              aria-pressed={Boolean(q.flagged)}
            >
              <Flag />
            </button>
          </div>

          <div className="options" role="radiogroup" aria-label="Answer options">
            {q.options?.map((option) => (
              <button
                key={option.key}
                role="radio"
                aria-checked={q.your_choice === option.key}
                className={`option ${q.your_choice === option.key ? 'selected' : ''}`}
                onClick={() => choose(option.key)}
                disabled={locked}
              >
                <b>{option.key}</b>
                <span dangerouslySetInnerHTML={{ __html: option.text }} />
              </button>
            ))}
          </div>
        </section>

        <aside className="player-rail">
          <Palette groups={groups} status={status} current={q.number} onJump={jump} />
        </aside>
      </div>

      <nav className="player-nav">
        <button className="secondary-button" onClick={() => setPalette(true)}>
          <Grid2X2 size={17} />
          <span>Questions</span>
          <b>{q.number}/{questionTotal}</b>
        </button>
        <button className="secondary-button" disabled={q.number <= 1} onClick={() => void goTo(q.number - 1)}>
          Previous
        </button>
        {q.number >= questionTotal ? (
          <button className="primary-button" onClick={() => void openSubmit()}>Submit</button>
        ) : (
          <button className="primary-button" onClick={() => void goTo(q.number + 1)}>Next</button>
        )}
      </nav>

      {toasts.length > 0 && (
        <div className="cbt-toasts" aria-hidden="true">
          {toasts.map((toast) => (
            <p key={toast.id} className="cbt-toast">{toast.text}</p>
          ))}
        </div>
      )}

      {palette && (
        <Sheet label="Questions" onClose={() => setPalette(false)}>
          <Palette groups={groups} status={status} current={q.number} onJump={jumpFromSheet} />
        </Sheet>
      )}

      {menu && (
        <Sheet label="Exam menu" onClose={() => setMenu(false)}>
          <h2>Exam menu</h2>
          <p className="cbt-sheet-note">
            {answered} answered · {unanswered} unanswered · {flagged} flagged
          </p>
          <label className="cbt-field">
            Text size
            <select value={size} onChange={(event) => setSize(event.target.value as typeof size)}>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </label>
          <button className="primary-button" onClick={() => void openSubmit()}>
            Submit exam
          </button>
          <button
            className="secondary-button"
            onClick={() => {
              setMenu(false)
              setLeave(true)
            }}
          >
            Leave exam
          </button>
        </Sheet>
      )}

      {submitOpen && (
        <Sheet label="Submit exam" onClose={() => (submitting ? undefined : setSubmitOpen(false))}>
          <h2>Submit exam?</h2>
          {submitPrep ? (
            <p className="cbt-sheet-note">
              <Loader2 className="cbt-spin" size={16} aria-hidden="true" /> Checking your answers…
            </p>
          ) : (
            <>
              <p className="cbt-sheet-note">
                Answered {answered} · Unanswered {unanswered} · Flagged {flagged}
              </p>
              {chips.length > 0 ? (
                <>
                  <p className="cbt-sheet-label">Unanswered or flagged</p>
                  <div className="cbt-chips">
                    {chips.map((number) => (
                      <button
                        key={number}
                        className={`cbt-chip ${status.get(number)?.flagged ? 'flagged' : ''}`}
                        onClick={() => {
                          setSubmitOpen(false)
                          void goTo(number)
                        }}
                      >
                        {number}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="cbt-sheet-note">Every question has an answer.</p>
              )}
            </>
          )}
          {submitError && <p className="cbt-error" role="alert">{submitError}</p>}
          <div className="cbt-actions">
            <button className="secondary-button" onClick={() => setSubmitOpen(false)} disabled={submitting}>
              Back to exam
            </button>
            <button
              className="primary-button"
              onClick={() => void submitExam(false)}
              disabled={submitting || submitPrep}
            >
              {submitting ? (
                <>
                  <Loader2 className="cbt-spin" size={16} aria-hidden="true" /> Submitting…
                </>
              ) : submitError ? (
                'Retry'
              ) : (
                'Submit exam'
              )}
            </button>
          </div>
        </Sheet>
      )}

      {leave && (
        <Sheet label="Leave exam" onClose={() => setLeave(false)}>
          <h2>Leave exam?</h2>
          <p className="cbt-sheet-note">The timer keeps running.</p>
          <div className="cbt-actions">
            <button className="secondary-button" onClick={() => setLeave(false)}>Stay</button>
            <button className="primary-button" onClick={() => router.push('/app')}>Leave</button>
          </div>
        </Sheet>
      )}

      {timeUp && (
        <div className="cbt-modal" role="dialog" aria-modal="true" aria-label="Time is up">
          <div className="cbt-modal-card">
            <h2>Time is up</h2>
            <p>Submitting your exam…</p>
            {submitError ? (
              <>
                <p className="cbt-error" role="alert">{submitError}</p>
                <button className="primary-button" onClick={() => void submitExam(false)} disabled={submitting}>
                  {submitting ? 'Retrying…' : 'Retry submit'}
                </button>
              </>
            ) : (
              <p className="cbt-modal-wait">
                <Loader2 className="cbt-spin" size={16} aria-hidden="true" /> Please wait
              </p>
            )}
          </div>
        </div>
      )}

      {zoom && (
        <div className="image-lightbox" onClick={() => setZoom(null)}>
          <img src={zoom} alt="Enlarged question figure" />
        </div>
      )}
    </main>
  )
}

function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="palette-sheet" onClick={onClose}>
      <div className="report-sheet cbt-sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

const Palette = memo(function Palette({
  groups,
  status,
  current,
  onJump,
}: {
  groups: SubjectGroup[]
  status: Map<number, { answered: boolean; flagged: boolean }>
  current: number
  onJump: (number: number) => void
}) {
  if (!groups.length) return null
  return (
    <div className="palette">
      <h2>Questions</h2>
      {groups.map((group) => {
        const numbers = Array.from({ length: group.count }, (_, position) => group.start + position)
        const done = numbers.filter((number) => status.get(number)?.answered).length
        return (
          <section key={`${group.name}-${group.start}`} className="palette-group">
            <header className="palette-group-head">
              <strong>{group.name}</strong>
              <span>{done}/{group.count}</span>
            </header>
            <div className="palette-grid">
              {numbers.map((number) => {
                const item = status.get(number)
                return (
                  <button
                    key={number}
                    className={`${number === current ? 'current ' : ''}${item?.answered ? 'answered ' : ''}${item?.flagged ? 'flagged' : ''}`}
                    onClick={() => onJump(number)}
                    aria-label={`Question ${number}${item?.answered ? ', answered' : ''}${item?.flagged ? ', flagged' : ''}`}
                    aria-current={number === current ? 'true' : undefined}
                  >
                    {number}
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
      <p className="palette-legend">Answered · Flagged · Current</p>
    </div>
  )
})
