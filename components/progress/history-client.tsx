'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { LoaderCircle, RefreshCw } from 'lucide-react'
import { dayHeading, dayKey } from '@/lib/dates'
import type { HistoryFacet, HistoryItem, HistoryPage } from '@/lib/progress'
import { SessionRow } from './session-row'

type Props = {
  initial: HistoryPage
  facets: HistoryFacet[]
  mode: 'practice' | 'cbt' | null
  exam: string | null
}

const skeletonRows = [0, 1, 2]

export function HistoryClient({ initial, facets, mode, exam }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<HistoryItem[]>(initial.items)
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const sentinel = useRef<HTMLDivElement | null>(null)

  // A new filter arrives as fresh server props: start the list again from page 1.
  useEffect(() => {
    setItems(initial.items)
    setCursor(initial.nextCursor)
    setError('')
  }, [initial])

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (mode) params.set('mode', mode)
    if (exam) params.set('exam', exam)
    return params.toString()
  }, [mode, exam])

  const loadMore = useCallback(async () => {
    if (!cursor || loading) return
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams(query)
      params.set('cursor', cursor)
      const response = await fetch(`/api/history?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('request failed')
      const page = (await response.json()) as HistoryPage
      setItems((current) => [...current, ...page.items])
      setCursor(page.nextCursor)
    } catch {
      setError("We couldn't load more sessions.")
    } finally {
      setLoading(false)
    }
  }, [cursor, loading, query])

  useEffect(() => {
    const node = sentinel.current
    if (!node || !cursor || error) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore()
      },
      { rootMargin: '240px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [cursor, error, loadMore])

  const groups = useMemo(() => {
    const buckets: Array<{ key: string; heading: string; items: HistoryItem[] }> = []
    for (const item of items) {
      const key = dayKey(item.created_at)
      const last = buckets[buckets.length - 1]
      if (last && last.key === key) last.items.push(item)
      else buckets.push({ key, heading: dayHeading(key), items: [item] })
    }
    return buckets
  }, [items])

  const go = (href: string) => startTransition(() => router.replace(href, { scroll: false }))

  const chips = [
    { key: 'all', label: 'All', href: '/progress/history', active: !mode && !exam },
    { key: 'practice', label: 'Practice', href: '/progress/history?mode=practice', active: mode === 'practice' },
    { key: 'cbt', label: 'CBT', href: '/progress/history?mode=cbt', active: mode === 'cbt' },
    ...facets.map((facet) => ({
      key: facet.slug,
      label: facet.name,
      href: `/progress/history?exam=${encodeURIComponent(facet.slug)}`,
      active: exam === facet.slug,
    })),
  ]

  const empty = items.length === 0 && !loading

  return (
    <div className="pg-page pg-history">
      <div className="pg-chips" role="tablist" aria-label="Filter sessions">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            role="tab"
            aria-selected={chip.active}
            className={`pg-chip${chip.active ? ' is-active' : ''}`}
            onClick={() => go(chip.href)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {empty ? (
        <section className="pg-empty">
          <h2>{mode === 'cbt' ? 'No CBT sessions yet' : mode === 'practice' ? 'No practice sessions yet' : 'No sessions yet'}</h2>
          <p>
            {mode === 'cbt'
              ? 'Sit a timed paper and it will show up here with your score.'
              : mode === 'practice'
                ? 'Work through a subject set and your sessions will appear here.'
                : 'Everything you practise or sit, timed, appears here.'}
          </p>
          <Link className="primary-button" href={mode === 'cbt' ? '/cbt' : '/practice'}>
            {mode === 'cbt' ? 'Start a CBT' : 'Start practising'}
          </Link>
        </section>
      ) : (
        <div className={`pg-groups${pending ? ' is-pending' : ''}`}>
          {groups.map((group) => (
            <section className="pg-group" key={group.key}>
              <h2 className="pg-group-title">{group.heading}</h2>
              <div className="pg-rows">
                {group.items.map((item) => (
                  <SessionRow key={item.id} item={item} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {loading && (
        <div className="pg-rows pg-skeletons" aria-hidden="true">
          {skeletonRows.map((row) => (
            <div className="pg-skeleton" key={row} />
          ))}
        </div>
      )}

      {error && (
        <div className="pg-error" role="alert">
          <p>{error}</p>
          <button type="button" className="pg-secondary" onClick={() => void loadMore()}>
            <RefreshCw size={15} /> Retry
          </button>
        </div>
      )}

      {cursor && !error && <div ref={sentinel} className="pg-sentinel" aria-hidden="true" />}

      {cursor && !error && (
        <button type="button" className="pg-more" onClick={() => void loadMore()} disabled={loading}>
          {loading ? (
            <>
              <LoaderCircle size={15} className="pg-spin" /> Loading
            </>
          ) : (
            'Load more'
          )}
        </button>
      )}
    </div>
  )
}
