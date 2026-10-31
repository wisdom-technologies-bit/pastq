import 'server-only'
import { db } from '@/lib/auth/db'
import { normaliseResult } from '@/lib/results'
import { addDays, dayKey, todayKey, weekStartKey } from '@/lib/dates'

/** Only the columns this feature reads. bank_session_id is never selected, so it
 *  can never leak into a page or an API payload. */
const columns = 'id,mode,exam_slug,exam_name,exam_year,subject_slugs,subject_names,total_questions,answered_count,feedback_mode,status,started_at,deadline_at,submitted_at,last_activity_at,result_summary,created_at'
const HISTORY_STATUSES = 'in.(in_progress,submitted,expired,abandoned)'
const COMPLETED_STATUSES = 'in.(submitted,expired)'

export type HistoryRow = {
  id: string
  mode: 'practice' | 'cbt'
  exam_slug: string
  exam_name: string
  exam_year: number | null
  subject_slugs: string[] | null
  subject_names: string[] | null
  total_questions: number | null
  answered_count: number | null
  feedback_mode: 'instant' | 'end' | null
  status: 'created' | 'in_progress' | 'submitted' | 'expired' | 'abandoned'
  started_at: string | null
  deadline_at: string | null
  submitted_at: string | null
  last_activity_at: string | null
  result_summary: unknown
  created_at: string
}

export type HistoryItem = {
  id: string
  mode: 'practice' | 'cbt'
  exam_slug: string
  exam_name: string
  exam_year: number | null
  subject_names: string[]
  total_questions: number
  answered_count: number
  status: HistoryRow['status']
  percent: number | null
  correct: number
  total: number
  score_400: number | null
  time_used_seconds: number | null
  created_at: string
  submitted_at: string | null
}

export type HistoryPage = { items: HistoryItem[]; nextCursor: string | null }
export type HistoryFacet = { slug: string; name: string }

/** One row shape for every surface that lists sessions. */
export function toHistoryItem(row: HistoryRow): HistoryItem {
  const result = normaliseResult(row.result_summary)
  const completed = row.status === 'submitted' || row.status === 'expired'
  const total = result?.total || row.total_questions || 0
  const answered = result?.answered ?? row.answered_count ?? 0
  return {
    id: row.id,
    mode: row.mode === 'cbt' ? 'cbt' : 'practice',
    exam_slug: row.exam_slug,
    exam_name: row.exam_name,
    exam_year: row.exam_year ?? null,
    subject_names: row.subject_names ?? [],
    total_questions: row.total_questions ?? total,
    answered_count: answered,
    status: row.status,
    percent: completed && total > 0 ? Math.round(result?.percent ?? 0) : null,
    correct: result?.correct ?? 0,
    total,
    score_400: result?.score_400 ?? null,
    time_used_seconds: result?.time_used_seconds ?? null,
    created_at: row.created_at,
    submitted_at: row.submitted_at,
  }
}

export async function getHistoryPage(
  userId: string,
  options: { mode?: 'practice' | 'cbt'; exam?: string; cursor?: string; limit?: number } = {},
): Promise<HistoryPage> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50)
  const filters = [`user_id=eq.${encodeURIComponent(userId)}`, `status=${HISTORY_STATUSES}`]
  if (options.mode) filters.push(`mode=eq.${options.mode}`)
  if (options.exam) filters.push(`exam_slug=eq.${encodeURIComponent(options.exam)}`)
  if (options.cursor) filters.push(`created_at=lt.${encodeURIComponent(options.cursor)}`)
  const query = `?select=${columns}&${filters.join('&')}&order=created_at.desc&limit=${limit + 1}`
  const rows = (await db<HistoryRow[]>('study_sessions', {}, query)) ?? []
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  return {
    items: page.map(toHistoryItem),
    nextCursor: hasMore && page.length ? page[page.length - 1].created_at : null,
  }
}

/** Exam chips for the history filters: only exams this user actually has rows in. */
export async function getHistoryFacets(userId: string): Promise<HistoryFacet[]> {
  const rows = (await db<Array<{ exam_slug: string; exam_name: string }>>(
    'study_sessions',
    {},
    `?select=exam_slug,exam_name&user_id=eq.${encodeURIComponent(userId)}&status=${HISTORY_STATUSES}&order=created_at.desc&limit=300`,
  )) ?? []
  const seen = new Map<string, string>()
  for (const row of rows) if (row.exam_slug && !seen.has(row.exam_slug)) seen.set(row.exam_slug, row.exam_name || row.exam_slug)
  return Array.from(seen, ([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name))
}

export type TrendPoint = { id: string; date: string; percent: number; mode: 'practice' | 'cbt'; label: string; exam_slug: string }
export type ExamSummary = {
  slug: string
  name: string
  sessions: number
  best: number
  average: number
  lastAttempt: string
  bestScore400: number | null
}
export type SubjectSummary = { slug: string; name: string; exam_slug: string; exam_name: string; correct: number; total: number; percent: number }
export type ProgressSummary = {
  totals: {
    sessions: number
    answered: number
    correct: number
    accuracy: number
    studySeconds: number
    weekSessions: number
    weekAnswered: number
    weekSeconds: number
  }
  streak: { current: number; longest: number; practisedToday: boolean }
  trend: TrendPoint[]
  takeaway: string | null
  exams: ExamSummary[]
  subjects: { combined: boolean; strong: SubjectSummary[]; weak: SubjectSummary[] }
  recent: HistoryItem[]
}

const WINDOW = 300

export async function getProgressSummary(userId: string, now: Date = new Date()): Promise<ProgressSummary> {
  const rows = (await db<HistoryRow[]>('study_sessions', {}, `?select=${columns}&user_id=eq.${encodeURIComponent(userId)}&status=${COMPLETED_STATUSES}&order=created_at.desc&limit=${WINDOW}`)) ?? []
  const completed = rows.filter((row) => {
    const result = normaliseResult(row.result_summary)
    return Boolean(result && result.total > 0)
  })

  let answered = 0
  let correct = 0
  let studySeconds = 0
  const days = new Set<string>()
  const examMap = new Map<string, { name: string; percents: number[]; best: number; last: string; bestScore400: number | null }>()
  const subjectMap = new Map<string, { slug: string; name: string; exam_slug: string; exam_name: string; correct: number; total: number; answered: number }>()
  const weekStart = weekStartKey(now)
  let weekSessions = 0
  let weekAnswered = 0
  let weekSeconds = 0
  const trendAll: Array<TrendPoint & { sortKey: number }> = []

  for (const row of completed) {
    const result = normaliseResult(row.result_summary)
    if (!result || result.total <= 0) continue
    const key = dayKey(row.created_at)
    days.add(key)
    answered += result.answered
    correct += result.correct
    studySeconds += result.time_used_seconds
    if (key >= weekStart) {
      weekSessions += 1
      weekAnswered += result.answered
      weekSeconds += result.time_used_seconds
    }

    const percent = Math.round(result.percent)
    const examKey = row.exam_slug
    const exam = examMap.get(examKey) ?? { name: row.exam_name || examKey, percents: [], best: 0, last: row.created_at, bestScore400: null }
    exam.percents.push(percent)
    exam.best = Math.max(exam.best, percent)
    if (new Date(row.created_at).getTime() > new Date(exam.last).getTime()) exam.last = row.created_at
    if (typeof result.score_400 === 'number') exam.bestScore400 = Math.max(exam.bestScore400 ?? 0, result.score_400)
    examMap.set(examKey, exam)

    for (const subject of result.subjects) {
      if (!subject.slug) continue
      const id = `${examKey}::${subject.slug}`
      const entry = subjectMap.get(id) ?? { slug: subject.slug, name: subject.name, exam_slug: examKey, exam_name: row.exam_name || examKey, correct: 0, total: 0, answered: 0 }
      entry.correct += subject.correct
      entry.total += subject.total
      entry.answered += subject.answered
      subjectMap.set(id, entry)
    }

    if (result.answered > 0) {
      trendAll.push({
        id: row.id,
        date: row.created_at,
        percent,
        mode: row.mode === 'cbt' ? 'cbt' : 'practice',
        label: `${row.exam_name}${row.exam_year ? ` ${row.exam_year}` : ''}`,
        exam_slug: examKey,
        sortKey: new Date(row.created_at).getTime(),
      })
    }
  }

  const streak = streakFor(days, now)
  const trend = trendAll
    .sort((a, b) => a.sortKey - b.sortKey)
    .slice(-20)
    .map((point) => ({ id: point.id, date: point.date, percent: point.percent, mode: point.mode, label: point.label, exam_slug: point.exam_slug }))

  const exams: ExamSummary[] = Array.from(examMap, ([slug, value]) => ({
    slug,
    name: value.name,
    sessions: value.percents.length,
    best: value.best,
    average: Math.round(value.percents.reduce((sum, value) => sum + value, 0) / Math.max(value.percents.length, 1)),
    lastAttempt: value.last,
    bestScore400: value.bestScore400,
  })).sort((a, b) => new Date(b.lastAttempt).getTime() - new Date(a.lastAttempt).getTime())

  const qualifying = Array.from(subjectMap.values())
    .filter((entry) => entry.answered >= 20)
    .map<SubjectSummary>((entry) => ({
      slug: entry.slug,
      name: entry.name,
      exam_slug: entry.exam_slug,
      exam_name: entry.exam_name,
      correct: entry.correct,
      total: entry.total,
      percent: Math.round((entry.correct / entry.total) * 100),
    }))
    .sort((a, b) => a.percent - b.percent)

  const subjects = splitSubjects(qualifying)
  const recent = rows.slice(0, 5).map(toHistoryItem)

  return {
    totals: {
      sessions: completed.length,
      answered,
      correct,
      accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0,
      studySeconds,
      weekSessions,
      weekAnswered,
      weekSeconds,
    },
    streak,
    trend,
    takeaway: takeawayFor(trend),
    exams,
    subjects,
    recent,
  }
}

/** Weakest first, and no subject appears in both lists. */
function splitSubjects(sorted: SubjectSummary[]): ProgressSummary['subjects'] {
  if (!sorted.length) return { combined: false, strong: [], weak: [] }
  if (sorted.length < 4) return { combined: true, strong: [], weak: sorted }
  const strong = sorted.slice(-3).reverse()
  const strongKeys = new Set(strong.map((entry) => `${entry.exam_slug}::${entry.slug}`))
  const weak = sorted.slice(0, 3).filter((entry) => !strongKeys.has(`${entry.exam_slug}::${entry.slug}`))
  return { combined: false, strong, weak }
}

/** Consecutive Lagos days with a completed session, ending today (or yesterday
 *  when today has none yet), plus the longest run inside the window. */
function streakFor(days: Set<string>, now: Date) {
  const today = todayKey(now)
  const practisedToday = days.has(today)
  let current = 0
  let key = practisedToday ? today : addDays(today, -1)
  while (days.has(key)) {
    current += 1
    key = addDays(key, -1)
  }
  const sorted = Array.from(days).sort()
  let longest = 0
  let run = 0
  let previous: string | null = null
  for (const day of sorted) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1
    longest = Math.max(longest, run)
    previous = day
  }
  return { current, longest: Math.max(longest, current), practisedToday }
}

/** Only speaks when there is enough history to mean something. */
function takeawayFor(trend: TrendPoint[]): string | null {
  if (trend.length < 6) return null
  const recentWindow = trend.slice(-5)
  const previousWindow = trend.slice(-10, -5)
  if (!previousWindow.length) return null
  const average = (points: TrendPoint[]) => points.reduce((sum, point) => sum + point.percent, 0) / points.length
  const delta = Math.round(average(recentWindow) - average(previousWindow))
  if (delta >= 3) return `Up ${delta} points over your last 5 sessions`
  if (delta <= -3) return `Down ${Math.abs(delta)} points over your last 5 sessions`
  return 'Holding steady'
}
