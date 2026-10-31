import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireUser } from '@/lib/auth/session'
import { getHistoryFacets, getHistoryPage } from '@/lib/progress'
import { HistoryClient } from '@/components/progress/history-client'
import '@/components/progress/progress.css'

export const dynamic = 'force-dynamic'

export default async function HistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requireUser()
  const params = await searchParams
  const modeParam = typeof params.mode === 'string' ? params.mode : undefined
  const mode = modeParam === 'practice' || modeParam === 'cbt' ? modeParam : null
  const exam = typeof params.exam === 'string' && params.exam ? params.exam : null
  const [initial, facets] = await Promise.all([
    getHistoryPage(user.id, { mode: mode ?? undefined, exam: exam ?? undefined, limit: 20 }),
    getHistoryFacets(user.id),
  ])

  return (
    <div className="pg-page">
      <header className="pg-head">
        <Link className="pg-back" href="/progress" aria-label="Back to progress">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <p className="eyebrow">Progress</p>
          <h1>History</h1>
          <p className="pg-lede">Every session, newest first.</p>
        </div>
      </header>
      <HistoryClient initial={initial} facets={facets} mode={mode} exam={exam} />
    </div>
  )
}
