'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Check, Loader2, X, ZoomIn } from 'lucide-react'
import type { Option, PlayerMeta, Question } from './types'
import { normalizeQuestion } from './types'
import './feed.css'

const PAGE_SIZE = 30

type CardStatus = 'idle' | 'plain' | 'scored' | 'revealed'

type CardState = {
  choice: string | null
  correctChoice: string | null
  isCorrect: boolean | null
  status: CardStatus
  explanation: string
  pending: string | null
  error: string
}

const REPORT_REASONS: Array<[string, string]> = [
  ['typo', 'Typo'],
  ['wrong_answer', 'Wrong answer'],
  ['missing_option', 'Missing option'],
  ['bad_image', 'Image problem'],
  ['garbled_passage', 'Garbled passage'],
  ['other', 'Something else'],
]

function initialCard(item: Question): CardState {
  const choice = item.your_choice
  const correctChoice = item.correct_choice
  let status: CardStatus = 'idle'
  if (item.revealed || (choice && correctChoice)) status = item.revealed ? 'revealed' : 'scored'
  else if (choice) status = 'plain'
  return {
    choice,
    correctChoice,
    isCorrect: item.is_correct ?? (choice && correctChoice ? choice === correctChoice : null),
    status,
    explanation: item.explanation ?? '',
    pending: null,
    error: '',
  }
}

function stringOf(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function answerOf(body: unknown, ref: string): Record<string, unknown> | null {
  const root = (body ?? {}) as Record<string, unknown>
  const data = (root.data ?? root) as Record<string, unknown>
  const list = Array.isArray(data.answers) ? data.answers : Array.isArray(root.answers) ? (root.answers as unknown[]) : []
  const items = list.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
  return items.find((item) => item.ref === ref) ?? items[0] ?? null
}

export default function PracticeFeed({ meta }: { meta: PlayerMeta }) {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const instant = meta.feedback_mode === 'instant'

  const [items, setItems] = useState<Question[]>([])
  const [cards, setCards] = useState<Record<string, CardState>>({})
  const [total, setTotal] = useState(meta.total_questions)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(true)
  const [zoom, setZoom] = useState<string | null>(null)
  const [reportRef, setReportRef] = useState<string | null>(null)
  const [finishOpen, setFinishOpen] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState('')

  const moreAvailable = hasMore && (total <= 0 || items.length < total)

  const sentinel = useRef<HTMLDivElement>(null)
  const busy = useRef(false)
  const count = useRef(0)

  const patch = useCallback((ref: string, update: Partial<CardState>) => {
    setCards((current) => (current[ref] ? { ...current, [ref]: { ...current[ref], ...update } } : current))
  }, [])

  const load = useCallback(
    async (from: number) => {
      if (busy.current) return
      busy.current = true
      const append = from > 1
      if (append) setLoadingMore(true)
      else setLoading(true)
      try {
        const response = await fetch(`/api/sessions/${id}/questions?from=${from}&limit=${PAGE_SIZE}`, { cache: 'no-store' })
        if (!response.ok) throw new Error('unavailable')
        const body = (await response.json()) as Record<string, unknown>
        const data = body?.data
        const rows = Array.isArray(data) ? data : Array.isArray((data as Record<string, unknown>)?.items) ? (data as Record<string, unknown>).items as unknown[] : []
        const list = rows.map((row, index) => normalizeQuestion(row, from - 1 + index)).filter((item): item is Question => Boolean(item))
        count.current = append ? count.current + list.length : list.length
        const remoteTotal = Number((body?.meta as Record<string, unknown> | undefined)?.total_questions ?? (body?.meta as Record<string, unknown> | undefined)?.total ?? 0)
        if (Number.isFinite(remoteTotal) && remoteTotal > 0) setTotal(remoteTotal)
        setItems((current) => {
          const seen = new Set(current.map((item) => item.ref))
          return [...current, ...list.filter((item) => !seen.has(item.ref))]
        })
        setCards((current) => {
          const next = { ...current }
          for (const item of list) if (!next[item.ref]) next[item.ref] = initialCard(item)
          return next
        })
        setHasMore(list.length >= PAGE_SIZE)
        setError('')
      } catch {
        setError(append ? 'Could not load more questions.' : "We couldn't load this practice right now.")
      } finally {
        busy.current = false
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [id],
  )

  useEffect(() => {
    load(1)
  }, [load])

  useEffect(() => {
    const node = sentinel.current
    if (!node || !moreAvailable || loading || loadingMore || error) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !busy.current) load(count.current + 1)
      },
      { rootMargin: '600px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [moreAvailable, loading, loadingMore, error, load])

  useEffect(() => {
    if (!finishOpen && !reportRef) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [finishOpen, reportRef])

  const answered = useMemo(
    () =>
      items.reduce((sum, item) => {
        const card = cards[item.ref]
        const choice = card ? card.choice : item.your_choice
        return choice ? sum + 1 : sum
      }, 0),
    [items, cards],
  )
  const questionTotal = total || items.length
  const percent = questionTotal ? Math.min(100, (answered / questionTotal) * 100) : 0
  const title = useMemo(() => {
    const head = meta.subject_names.filter(Boolean).join(', ')
    const tail = [meta.exam_name, meta.exam_year].filter(Boolean).join(' ')
    return [head, tail].filter(Boolean).join(' · ')
  }, [meta.subject_names, meta.exam_name, meta.exam_year])

  async function choose(item: Question, key: string) {
    const card = cards[item.ref]
    if (!card || card.pending) return
    if (card.status === 'scored' || card.status === 'revealed') return

    if (!instant) {
      const next = card.choice === key ? null : key
      patch(item.ref, { choice: next, pending: key, error: '' })
      try {
        const response = await fetch(`/api/sessions/${id}/answers`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: [{ ref: item.ref, choice: next }] }),
        })
        if (!response.ok) throw new Error('failed')
        patch(item.ref, { pending: null, status: next ? 'plain' : 'idle' })
      } catch {
        patch(item.ref, { choice: card.choice, pending: null, error: 'Could not save that. Please try again.' })
      }
      return
    }

    patch(item.ref, { pending: key, error: '' })
    try {
      const response = await fetch(`/api/sessions/${id}/answers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: [{ ref: item.ref, choice: key }] }),
      })
      if (response.status === 409) {
        patch(item.ref, { choice: key, pending: null, status: 'plain', correctChoice: null, isCorrect: null })
        return
      }
      if (!response.ok) throw new Error('failed')
      const body = await response.json().catch(() => null)
      const answer = answerOf(body, item.ref)
      const correctChoice = stringOf(answer?.correct_choice) || null
      if (!correctChoice) {
        patch(item.ref, { choice: key, pending: null, status: 'plain', correctChoice: null, isCorrect: null })
        return
      }
      patch(item.ref, {
        choice: key,
        pending: null,
        status: 'scored',
        correctChoice,
        isCorrect: typeof answer?.is_correct === 'boolean' ? (answer.is_correct as boolean) : key === correctChoice,
        explanation: stringOf(answer?.explanation),
      })
    } catch {
      patch(item.ref, { pending: null, error: 'Could not save that. Please try again.' })
    }
  }

  async function reveal(item: Question) {
    const card = cards[item.ref]
    if (!card || card.choice || card.pending) return
    patch(item.ref, { pending: 'reveal', error: '' })
    try {
      const response = await fetch(`/api/sessions/${id}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: item.ref }),
      })
      if (!response.ok) {
        patch(item.ref, { pending: null, error: "Couldn't show the answer right now." })
        return
      }
      const body = (await response.json().catch(() => null)) as Record<string, unknown> | null
      const root = (body?.data ?? body ?? {}) as Record<string, unknown>
      const nested = (root.answer ?? {}) as Record<string, unknown>
      const correctChoice =
        stringOf(root.correct_choice) || stringOf(nested.correct_choice) || stringOf(answerOf(body, item.ref)?.correct_choice) || null
      const explanation = stringOf(root.explanation) || stringOf(nested.explanation) || stringOf(answerOf(body, item.ref)?.explanation)
      patch(item.ref, { pending: null, status: 'revealed', correctChoice, isCorrect: null, explanation })
    } catch {
      patch(item.ref, { pending: null, error: "Couldn't show the answer right now." })
    }
  }

  async function finish() {
    if (finishing) return
    setFinishing(true)
    setFinishError('')
    try {
      const response = await fetch(`/api/sessions/${id}/submit`, { method: 'POST' })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setFinishError(stringOf((body as Record<string, unknown> | null)?.error) || 'We could not finish this session. Please try again.')
        setFinishing(false)
        return
      }
      router.replace(`/practice/session/${id}/result`)
    } catch {
      setFinishError('We could not reach PastQ. Check your connection and try again.')
      setFinishing(false)
    }
  }

  const passageStart = useMemo(() => {
    const map: Record<string, boolean> = {}
    let previous = ''
    for (const item of items) {
      const key = item.passage ? item.passageKey || item.passage : ''
      map[item.ref] = Boolean(key) && key !== previous
      previous = key
    }
    return map
  }, [items])

  const reportItem = reportRef ? items.find((item) => item.ref === reportRef) ?? null : null

  return (
    <main className="feed-page">
      <header className="feed-top">
        <button type="button" className="feed-back" aria-label="Back to session" onClick={() => router.push(`/practice/session/${id}`)}>
          <ArrowLeft />
        </button>
        <h1 title={title}>{title}</h1>
        <button type="button" className="feed-finish" onClick={() => setFinishOpen(true)}>Finish</button>
      </header>
      <div className="feed-meter">
        <div className="feed-meter-track" role="progressbar" aria-valuemin={0} aria-valuemax={questionTotal} aria-valuenow={answered} aria-label="Questions answered">
          <span style={{ width: `${percent}%` }} />
        </div>
        <p>{answered} / {questionTotal} answered</p>
      </div>

      <div className="feed-body">
        {loading && !items.length && (
          <>
            <div className="feed-skeleton" />
            <div className="feed-skeleton" />
            <div className="feed-skeleton short" />
          </>
        )}

        {!loading && error && !items.length && (
          <div className="feed-error" role="alert">
            <p>{error}</p>
            <button type="button" className="feed-retry" onClick={() => load(1)}>Retry</button>
          </div>
        )}

        {items.map((item) => (
          <QuestionCard
            key={item.ref}
            item={item}
            card={cards[item.ref] ?? initialCard(item)}
            instant={instant}
            passageOpen={passageStart[item.ref] === true}
            onChoose={choose}
            onReveal={reveal}
            onZoom={setZoom}
            onReport={setReportRef}
          />
        ))}

        {loadingMore && <div className="feed-skeleton" />}

        {error && items.length > 0 && (
          <div className="feed-error" role="alert">
            <p>{error}</p>
            <button type="button" className="feed-retry" onClick={() => load(count.current + 1)}>Retry</button>
          </div>
        )}

        <div ref={sentinel} className="feed-sentinel" aria-hidden="true" />

        {moreAvailable && !loadingMore && (
          <button type="button" className="feed-more" onClick={() => load(count.current + 1)}>Load more</button>
        )}

        {items.length > 0 && (
          <button type="button" className="feed-final" onClick={() => setFinishOpen(true)}>Finish practice</button>
        )}
      </div>

      {finishOpen && (
        <Sheet label="Finish practice?" onClose={() => (finishing ? undefined : setFinishOpen(false))}>
          <h2>Finish practice?</h2>
          <p className="feed-sheet-note">You answered {answered} of {questionTotal} questions. Finish now?</p>
          {finishError && <p className="feed-sheet-error" role="alert">{finishError}</p>}
          <div className="feed-sheet-actions">
            <button type="button" className="feed-secondary" onClick={() => setFinishOpen(false)} disabled={finishing}>Keep practising</button>
            <button type="button" className="feed-primary" onClick={finish} disabled={finishing}>
              {finishing ? <><Loader2 className="feed-spin" size={17} aria-hidden="true" /> Finishing…</> : finishError ? 'Retry' : 'Finish'}
            </button>
          </div>
        </Sheet>
      )}

      {reportRef && (
        <ReportSheet
          key={reportRef}
          id={id}
          refId={reportRef}
          number={reportItem?.number ?? 0}
          onClose={() => setReportRef(null)}
        />
      )}

      {zoom && (
        <div className="image-lightbox" role="dialog" aria-label="Question image" onClick={() => setZoom(null)}>
          <img src={zoom} alt="Enlarged question figure" />
        </div>
      )}
    </main>
  )
}

function QuestionCard({
  item,
  card,
  instant,
  passageOpen,
  onChoose,
  onReveal,
  onZoom,
  onReport,
}: {
  item: Question
  card: CardState
  instant: boolean
  passageOpen: boolean
  onChoose: (item: Question, key: string) => void
  onReveal: (item: Question) => void
  onZoom: (url: string) => void
  onReport: (ref: string) => void
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const shown = card.status === 'scored' || card.status === 'revealed'
  const busy = Boolean(card.pending)
  const locked = instant && (shown || card.status === 'plain')
  const wrongChoice = card.status === 'scored' && card.isCorrect === false ? card.choice : null
  const canReveal = instant && card.status === 'idle' && !card.choice && !busy
  const note =
    card.status === 'revealed'
      ? 'Answer revealed. This one won\u2019t be scored.'
      : card.status === 'scored'
        ? card.isCorrect
          ? 'Correct'
          : `Not quite. The answer is ${card.correctChoice ?? ''}`.trim()
        : ''

  return (
    <article className="feed-card">
      <header className="feed-card-head">
        <strong>Question {item.number}</strong>
        {item.subject && <span>{item.subject}</span>}
      </header>

      {item.instruction && <p className="feed-instruction" dangerouslySetInnerHTML={{ __html: item.instruction }} />}

      {item.passage && (
        <details className="feed-passage" open={passageOpen}>
          <summary>Passage</summary>
          <div dangerouslySetInnerHTML={{ __html: item.passage }} />
        </details>
      )}

      <div className="feed-question" dangerouslySetInnerHTML={{ __html: item.text }} />

      {item.image_url && !imageFailed && (
        <button type="button" className="feed-figure" onClick={() => item.image_url && onZoom(item.image_url)} aria-label="Zoom question image">
          <img
            src={item.image_url}
            alt={`Diagram for question ${item.number}`}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
          <ZoomIn size={16} aria-hidden="true" />
        </button>
      )}
      {item.image_url && imageFailed && <p className="feed-figure-error">Image couldn&apos;t load</p>}

      <div className="feed-options" role="group" aria-label="Answer options">
        {item.options.map((option) => (
          <OptionRow
            key={option.key}
            option={option}
            chosen={card.choice === option.key}
            correct={shown && card.correctChoice === option.key}
            wrong={wrongChoice === option.key}
            dimmed={shown && card.correctChoice !== null && card.correctChoice !== option.key && card.choice !== option.key}
            pending={card.pending === option.key}
            disabled={locked || busy}
            onSelect={() => onChoose(item, option.key)}
          />
        ))}
      </div>

      {note && <p className={`feed-result ${card.status === 'scored' ? (card.isCorrect ? 'ok' : 'no') : 'note'}`} aria-live="polite">{note}</p>}

      {(canReveal || card.pending === 'reveal') && (
        <button
          type="button"
          className="feed-reveal"
          onClick={() => onReveal(item)}
          disabled={card.pending === 'reveal'}
        >
          {card.pending === 'reveal' ? 'Showing…' : 'Show answer'}
        </button>
      )}

      {card.error && <p className="feed-card-error" role="alert">{card.error}</p>}

      {card.explanation && (
        <details className="feed-explanation">
          <summary>Explanation</summary>
          <div dangerouslySetInnerHTML={{ __html: card.explanation }} />
        </details>
      )}

      <footer className="feed-card-foot">
        <button type="button" className="feed-report" onClick={() => onReport(item.ref)}>Report a problem</button>
      </footer>
    </article>
  )
}

function OptionRow({
  option,
  chosen,
  correct,
  wrong,
  dimmed,
  pending,
  disabled,
  onSelect,
}: {
  option: Option
  chosen: boolean
  correct: boolean
  wrong: boolean
  dimmed: boolean
  pending: boolean
  disabled: boolean
  onSelect: () => void
}) {
  const classes = ['feed-option']
  if (chosen) classes.push('chosen')
  if (correct) classes.push('correct')
  if (wrong) classes.push('wrong')
  if (dimmed) classes.push('dim')
  return (
    <button
      type="button"
      className={classes.join(' ')}
      aria-pressed={chosen}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onSelect}
    >
      <b className="feed-key" aria-hidden="true">{option.key}</b>
      <span className="feed-option-text" dangerouslySetInnerHTML={{ __html: option.text }} />
      {pending && <Loader2 className="feed-spin feed-option-icon" size={16} aria-label="Saving" />}
      {!pending && correct && <Check className="feed-option-icon" size={16} aria-hidden="true" />}
      {!pending && wrong && <X className="feed-option-icon" size={16} aria-hidden="true" />}
      {!pending && correct && <span className="feed-option-tag">Correct answer</span>}
      {!pending && wrong && <span className="feed-option-tag">Your answer</span>}
    </button>
  )
}

function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="feed-sheet-backdrop" role="presentation" onClick={onClose}>
      <section
        className="feed-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </section>
    </div>
  )
}

function ReportSheet({
  id,
  refId,
  number,
  onClose,
}: {
  id: string
  refId: string
  number: number
  onClose: () => void
}) {
  const [reason, setReason] = useState('typo')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function send() {
    if (status === 'sending' || status === 'sent') return
    setStatus('sending')
    try {
      const response = await fetch(`/api/sessions/${id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: refId, reason, note: note.slice(0, 300) }),
      })
      if (!response.ok) throw new Error('failed')
      setStatus('sent')
      setTimeout(onClose, 700)
    } catch {
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <Sheet label="Report sent" onClose={onClose}>
        <h2>Report sent</h2>
        <p className="feed-sheet-note">Thanks, we&apos;ll take a look.</p>
      </Sheet>
    )
  }

  return (
    <Sheet label={`Report question ${number}`} onClose={onClose}>
      <h2>Report {number ? `question ${number}` : 'a problem'}</h2>
      <div className="feed-reasons">
        {REPORT_REASONS.map(([value, label]) => (
          <label key={value} className={reason === value ? 'on' : ''}>
            <input type="radio" name={`report-${refId}`} checked={reason === value} onChange={() => setReason(value)} />
            {label}
          </label>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value.slice(0, 300))}
        maxLength={300}
        placeholder="Optional note"
        aria-label="Optional note"
      />
      {status === 'error' && <p className="feed-sheet-error" role="alert">We couldn&apos;t send that report. Please try again.</p>}
      <div className="feed-sheet-actions">
        <button type="button" className="feed-secondary" onClick={onClose} disabled={status === 'sending'}>Cancel</button>
        <button type="button" className="feed-primary" onClick={send} disabled={status === 'sending'}>
          {status === 'sending' ? <><Loader2 className="feed-spin" size={17} aria-hidden="true" /> Sending…</> : 'Send report'}
        </button>
      </div>
    </Sheet>
  )
}
