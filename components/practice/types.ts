export type PlayerMeta = {
  mode: 'practice' | 'cbt'
  exam_name: string
  exam_year: number | null
  subject_names: string[]
  feedback_mode: 'instant' | 'end'
  total_questions: number
}

export type Option = { key: string; text: string }

export type Question = {
  ref: string
  number: number
  subject: string
  instruction: string
  passage: string
  passageKey: string
  text: string
  image_url: string | null
  options: Option[]
  your_choice: string | null
  flagged: boolean
  revealed: boolean
  correct_choice: string | null
  is_correct: boolean | null
  explanation: string | null
}

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

export function textOf(value: unknown): string {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return ''
  const record = value as Record<string, unknown>
  return textOf(record.html ?? record.text ?? record.content ?? '')
}

const DANGEROUS = /<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi
const INLINE_IMAGE = /<img[^>]*>/gi
const EVENT_ATTRIBUTE = /\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi

/** Same sanitiser the existing player uses, plus script/style removal. */
export function cleanHtml(html: string): string {
  return html.replace(DANGEROUS, '').replace(INLINE_IMAGE, '').replace(EVENT_ATTRIBUTE, '')
}

export function cleanText(value: unknown): string {
  return cleanHtml(textOf(value))
}

export function safeImage(value: unknown): string | null {
  return typeof value === 'string' && value.startsWith('https://') ? value : null
}

function rawText(raw: Record<string, unknown>): string {
  const nested = raw.question
  if (typeof nested === 'string') return cleanText(nested)
  if (nested && typeof nested === 'object') {
    const object = nested as Record<string, unknown>
    const text = textOf(object.text ?? object.html)
    if (text) return cleanHtml(text)
  }
  return cleanText(raw.text ?? raw.question_text ?? raw.stem ?? '')
}

function rawImage(raw: Record<string, unknown>): string | null {
  const nested = raw.question
  const fromNested = nested && typeof nested === 'object' ? safeImage((nested as Record<string, unknown>).image_url) : null
  return safeImage(raw.image_url) ?? safeImage(raw.imageUrl) ?? fromNested
}

function rawOptions(raw: Record<string, unknown>): Option[] {
  if (!Array.isArray(raw.options)) return []
  const seen: Option[] = []
  raw.options.forEach((option, index) => {
    if (!option || typeof option !== 'object') return
    const record = option as Record<string, unknown>
    const key = LETTERS[index]
    const text = cleanHtml(textOf(record.text ?? record.label ?? record.html))
    if (!text) return
    seen.push({ key: String(record.key ?? key), text })
  })
  return seen
}

/** Accepts both the flat feed contract and the nested Bank envelope. */
export function normalizeQuestion(raw: unknown, index: number): Question | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const options = rawOptions(record)
  const text = rawText(record)
  if (!options.length || !text) return null
  const choice = typeof record.your_choice === 'string' ? record.your_choice : null
  const correct = typeof record.correct_choice === 'string' ? record.correct_choice : null
  return {
    ref: String(record.ref ?? record.id ?? `question-${index + 1}`),
    number: Number(record.number ?? index + 1),
    subject: typeof record.subject === 'string' ? record.subject : '',
    instruction: cleanHtml(textOf(record.instruction ?? record.instructions ?? '')),
    passage: cleanHtml(textOf(record.passage ?? record.passage_text ?? '')),
    passageKey: String(
      record.passage_ref ?? record.passage_id ?? record.passage_group ?? record.passage_title ?? textOf(record.passage ?? '') ?? '',
    ),
    text,
    image_url: rawImage(record),
    options,
    your_choice: choice,
    flagged: record.flagged === true,
    revealed: record.revealed === true,
    correct_choice: correct,
    is_correct: typeof record.is_correct === 'boolean' ? record.is_correct : null,
    explanation: cleanHtml(textOf(record.explanation ?? '')),
  }
}
