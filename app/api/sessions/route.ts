import { NextResponse } from 'next/server'
import { z } from 'zod'
import { assertSameOrigin } from '@/lib/auth/origin'
import { getCurrentUser } from '@/lib/auth/session'
import { db, rpc } from '@/lib/auth/db'
import { getCbtPlan, getExamProfile, getSubjects, getYears } from '@/lib/bank/catalog'
import { bankFetch, BankRequestError } from '@/lib/bank/client'
import { getTier } from '@/lib/entitlements'
import type { PastQUser } from '@/lib/auth/session'

const practiceSchema = z.object({ mode: z.literal('practice'), exam: z.string().min(1), year: z.coerce.number().int(), subject: z.string().min(1), count: z.coerce.number().int(), instantFeedback: z.boolean() })
const cbtSchema = z.object({
  mode: z.literal('cbt'),
  exam: z.string().min(1),
  year: z.coerce.number().int(),
  subjects: z.array(z.string().min(1)).min(1).max(12),
  missingCompulsory: z.enum(['skip', 'borrow']).optional(),
})
const schema = z.discriminatedUnion('mode', [practiceSchema, cbtSchema])

/** Setup rejected before the Bank is called. Carries the same codes the Bank uses. */
class SetupError extends Error {
  code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

const messages: Record<string, string> = {
  premium_required: 'Premium is required for this year.',
  compulsory_subject_required: 'The compulsory subject is required for this exam.',
  compulsory_subject_missing: 'The compulsory subject is not available for this year yet.',
  too_many_active_sessions: 'You have 5 sessions open. Finish or leave one first.',
  not_enough_questions: 'There are not enough questions for that selection.',
  invalid_config: 'That setup is not available.',
  unauthorized: 'Sign in again to continue.',
  bank_unavailable: 'The Bank is taking a short rest. Please try again.',
}

async function startPractice(values: z.infer<typeof practiceSchema>, current: { user: PastQUser }, tier: 'free' | 'premium') {
  const [profile, catalog, years] = await Promise.all([getExamProfile(values.exam, current.user), getSubjects(values.exam, values.year, current.user), getYears(values.exam, current.user)])
  const year = years.find((item) => item.year === values.year)
  const subject = catalog.subjects.find((item) => item.slug === values.subject)
  const max = Math.min(subject?.published_count ?? 0, profile.max_questions)
  if (!year || !subject || !year.practice_ready || !subject.practice_ready || values.count < profile.min_questions || values.count > max) return NextResponse.json({ error: 'That practice setup is not available.' }, { status: 400 })
  const created = await bankFetch<{ data: { id: string } }>(`/sessions`, { method: 'POST', body: JSON.stringify({ user_ref: current.user.id, tier, mode: 'practice', exam: values.exam, year: values.year, subjects: [{ slug: subject.slug, question_count: values.count }], feedback: values.instantFeedback ? 'instant' : 'end' }) }, { userId: current.user.id, tier })
  const bankId = created.data.id
  await bankFetch(`/sessions/${bankId}/start`, { method: 'POST', body: JSON.stringify({}) }, { userId: current.user.id, tier })
  const rows = await db<Array<{ id: string }>>('study_sessions', { method: 'POST', body: JSON.stringify({ user_id: current.user.id, bank_session_id: bankId, mode: 'practice', exam_slug: values.exam, exam_name: (await getExamProfile(values.exam, current.user)).display_name, exam_year: values.year, subject_slugs: [subject.slug], subject_names: [subject.name], total_questions: values.count, feedback_mode: values.instantFeedback ? 'instant' : 'end', status: 'in_progress', started_at: new Date().toISOString(), last_activity_at: new Date().toISOString() }) })
  return NextResponse.json({ id: rows[0].id })
}

async function startCbt(values: z.infer<typeof cbtSchema>, current: { user: PastQUser }, tier: 'free' | 'premium') {
  const [profile, plan, catalog] = await Promise.all([
    getExamProfile(values.exam, current.user),
    getCbtPlan(values.exam, values.year, tier),
    getSubjects(values.exam, values.year, current.user),
  ])

  const slugs = Array.from(new Set(values.subjects))
  const qualifying = new Set(plan.qualifyingSubjects)
  if (slugs.some((slug) => !qualifying.has(slug))) throw new SetupError('invalid_config')

  const borrowing = values.missingCompulsory === 'borrow'
  if (borrowing && !(plan.missing && plan.borrow?.available)) throw new SetupError('invalid_config')

  const compulsory = profile.compulsory_subject_slug ?? plan.compulsorySubject ?? null
  if (!plan.missing && compulsory && qualifying.has(compulsory) && !slugs.includes(compulsory)) throw new SetupError('compulsory_subject_required')

  const total = slugs.length + (borrowing ? 1 : 0)
  if (total < plan.minSubjects || total > plan.maxSubjects) throw new SetupError('invalid_config')

  const created = await bankFetch<{ data: { id: string; status?: string; total_questions?: number; duration_seconds?: number | null; subjects?: Array<{ slug: string; name?: string; question_count?: number }> } }>(
    '/sessions',
    {
      method: 'POST',
      body: JSON.stringify({
        user_ref: current.user.id,
        tier,
        mode: 'cbt',
        exam: values.exam,
        year: values.year,
        subjects: slugs.map((slug) => ({ slug })),
        ...(plan.missing ? { missing_compulsory: borrowing ? 'borrow' : 'skip' } : {}),
        feedback: 'end',
      }),
    },
    { userId: current.user.id, tier },
  )

  const bankId = created.data.id
  const started = await bankFetch<{ data: { started_at?: string; deadline_at?: string | null; server_time?: string } }>(`/sessions/${bankId}/start`, { method: 'POST', body: JSON.stringify({}) }, { userId: current.user.id, tier })

  const bankSubjects = Array.isArray(created.data.subjects) ? created.data.subjects : []
  const catalogName = new Map(catalog.subjects.map((subject) => [subject.slug, subject.name]))
  const subjectSlugs = bankSubjects.length ? bankSubjects.map((subject) => subject.slug) : slugs
  const subjectNames = bankSubjects.length
    ? bankSubjects.map((subject) => subject.name ?? catalogName.get(subject.slug) ?? subject.slug)
    : slugs.map((slug) => catalogName.get(slug) ?? slug)

  const totalQuestions = Number(created.data.total_questions ?? 0) || profile.default_question_count * Math.max(1, subjectSlugs.length)
  const durationSeconds = created.data.duration_seconds ?? null
  const now = new Date().toISOString()

  const rows = await db<Array<{ id: string }>>('study_sessions', {
    method: 'POST',
    body: JSON.stringify({
      user_id: current.user.id,
      bank_session_id: bankId,
      mode: 'cbt',
      exam_slug: values.exam,
      exam_name: profile.display_name,
      exam_year: values.year,
      subject_slugs: subjectSlugs,
      subject_names: subjectNames,
      total_questions: totalQuestions,
      feedback_mode: 'end',
      duration_seconds: durationSeconds,
      status: 'in_progress',
      started_at: started.data?.started_at ?? now,
      deadline_at: started.data?.deadline_at ?? null,
      last_activity_at: now,
    }),
  })
  return NextResponse.json({ id: rows[0].id })
}

export async function POST(request: Request) {
  try {
    await assertSameOrigin()
    const current = await getCurrentUser()
    if (!current) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
    const values = schema.parse(await request.json())
    const allowed = await rpc<boolean>('check_rate_limit', { p_key: `start:${current.user.id}`, p_max: 10, p_window_seconds: 60 })
    if (!allowed) return NextResponse.json({ error: 'Too many starts. Try again in a moment.' }, { status: 429 })
    const tier = getTier(current.user)
    return values.mode === 'practice' ? await startPractice(values, current, tier) : await startCbt(values, current, tier)
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'That setup is not available.', code: 'invalid_config' }, { status: 400 })
    const code = error instanceof SetupError ? error.code : error instanceof BankRequestError ? error.code : 'bank_unavailable'
    return NextResponse.json({ error: messages[code] ?? messages.bank_unavailable, code }, { status: code === 'premium_required' ? 402 : 400 })
  }
}
