import { z } from 'zod'

const passthrough = z.object({}).passthrough()
export const examProfileSchema = z.object({ id: z.string(), exam_slug: z.string(), display_name: z.string(), subjects_required: z.number(), compulsory_subject_slug: z.string().nullable(), shared_timer: z.boolean(), total_minutes: z.number().nullable(), default_question_count: z.number(), default_minutes: z.number(), min_questions: z.number(), max_questions: z.number(), min_minutes: z.number(), max_minutes: z.number(), verified: z.boolean(), notes: z.string().nullable().optional(), subjects: z.array(z.object({ subject_slug: z.string(), question_count: z.number(), minutes: z.number().nullable() }).passthrough()) }).passthrough()
export const examSchema = z.object({ slug: z.string(), name: z.string(), profile: z.object({ subjects_required: z.number(), default_question_count: z.number(), default_minutes: z.number(), shared_timer: z.boolean(), total_minutes: z.number().nullable() }).passthrough(), listable_year_count: z.number(), subject_count: z.number(), total_published_questions: z.number() }).passthrough()
export const yearSchema = z.object({ year: z.number(), published_count: z.number(), subject_count: z.number(), access: z.enum(['free', 'premium']), practice_ready: z.boolean(), cbt: z.object({ eligible: z.boolean(), qualifyingSubjects: z.array(z.string()), missingCompulsory: z.string().optional(), reason: z.string().optional() }).passthrough().optional() }).passthrough()
export const subjectSchema = z.object({ slug: z.string(), name: z.string(), published_count: z.number(), passage_count: z.number(), has_images: z.boolean(), practice_ready: z.boolean(), cbt_ready: z.boolean(), default_question_count: z.number(), default_minutes: z.number() }).passthrough()
export const cbtPlanSchema = z.object({ compulsorySubject: z.string().nullable(), missing: z.boolean(), qualifyingSubjects: z.array(z.string()), minSubjects: z.number(), maxSubjects: z.number(), borrow: z.object({ available: z.boolean(), donorYear: z.number().nullable(), requiresActivation: z.boolean() }).passthrough().nullable() }).passthrough()
export const envelope = <T extends z.ZodTypeAny>(data: T) => z.object({ data, meta: passthrough.optional() }).passthrough()
export const examsResponseSchema = envelope(z.array(examSchema))
export const profileResponseSchema = envelope(examProfileSchema)
export const yearsResponseSchema = envelope(z.array(yearSchema))
export const subjectsResponseSchema = envelope(z.object({ access: z.enum(['free', 'premium']), subjects: z.array(subjectSchema) }).passthrough())
export const cbtPlanResponseSchema = envelope(cbtPlanSchema)
export type Exam = z.infer<typeof examSchema>
export type ExamProfile = z.infer<typeof examProfileSchema>
export type ExamYear = z.infer<typeof yearSchema>
export type ExamSubject = z.infer<typeof subjectSchema>
export type CbtPlan = z.infer<typeof cbtPlanSchema>
