import 'server-only'
import { bankFetch } from './client'
import { cbtPlanResponseSchema, examsResponseSchema, profileResponseSchema, subjectsResponseSchema, yearsResponseSchema, type CbtPlan, type Exam, type ExamProfile, type ExamSubject, type ExamYear } from './schemas'
import type { PastQUser } from '@/lib/auth/session'
import { getTier } from '@/lib/entitlements'
const cached = { cache: 'force-cache' as const, revalidate: 300 }
export async function getExams(user?: PastQUser): Promise<Exam[]> { return examsResponseSchema.parse(await bankFetch('/exams', {}, { tier: getTier(user), ...cached, tags: ['bank-exams'] })).data }
export async function getExamProfile(exam: string, user?: PastQUser): Promise<ExamProfile> { return profileResponseSchema.parse(await bankFetch(`/exams/${encodeURIComponent(exam)}/profile`, {}, { tier: getTier(user), ...cached, tags: [`bank-profile-${exam}`] })).data }
export async function getYears(exam: string, user?: PastQUser): Promise<ExamYear[]> { return yearsResponseSchema.parse(await bankFetch(`/exams/${encodeURIComponent(exam)}/years`, {}, { tier: getTier(user), ...cached, tags: [`bank-years-${exam}`] })).data }
export async function getSubjects(exam: string, year: number, user?: PastQUser): Promise<{ access: 'free' | 'premium'; subjects: ExamSubject[] }> { return subjectsResponseSchema.parse(await bankFetch(`/exams/${encodeURIComponent(exam)}/years/${year}/subjects`, {}, { tier: getTier(user), ...cached, tags: [`bank-subjects-${exam}-${year}`] })).data }
export async function getCbtPlan(exam: string, year: number, tier: 'free' | 'premium' = 'free'): Promise<CbtPlan> { return cbtPlanResponseSchema.parse(await bankFetch(`/exams/${encodeURIComponent(exam)}/years/${year}/cbt-plan?tier=${tier}`, {}, { tier, ...cached, tags: [`bank-cbt-${exam}-${year}-${tier}`] })).data }
