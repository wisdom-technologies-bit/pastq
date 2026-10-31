/** Counts only: never question text. Shared by the result page and progress. */
export type SubjectResult = {
  slug: string
  name: string
  total: number
  answered: number
  correct: number
  wrong: number
  unanswered: number
  percent: number
  score_100?: number | null
}

export type ResultData = {
  total: number
  answered: number
  correct: number
  wrong: number
  unanswered: number
  percent: number
  time_used_seconds: number
  score_400: number | null
  subjects: SubjectResult[]
}

const num = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const optionalNum = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Coerces whatever the Bank or a stored summary holds into one strict shape.
 *  Old rows can be null or partial, so every field falls back sensibly. */
export function normaliseResult(raw: unknown): ResultData | null {
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>
  const subjects: SubjectResult[] = Array.isArray(source.subjects)
    ? (source.subjects as Record<string, unknown>[])
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
          const total = num(item.total)
          const correct = num(item.correct)
          const answered = num(item.answered, correct + num(item.wrong))
          return {
            slug: String(item.slug ?? item.name ?? ''),
            name: String(item.name ?? item.slug ?? 'Subject'),
            total,
            answered,
            correct,
            wrong: num(item.wrong),
            unanswered: num(item.unanswered, Math.max(0, total - answered)),
            percent: num(item.percent, total > 0 ? (correct / total) * 100 : 0),
            score_100: optionalNum(item.score_100),
          }
        })
    : []
  const total = num(source.total)
  const answered = num(source.answered, subjects.reduce((sum, subject) => sum + subject.answered, 0))
  const correct = num(source.correct, subjects.reduce((sum, subject) => sum + subject.correct, 0))
  return {
    total,
    answered,
    correct,
    wrong: num(source.wrong, Math.max(0, answered - correct)),
    unanswered: num(source.unanswered, Math.max(0, total - answered)),
    percent: num(source.percent, total > 0 ? (correct / total) * 100 : 0),
    time_used_seconds: num(source.time_used_seconds ?? source.time_used),
    score_400: optionalNum(source.score_400),
    subjects,
  }
}
