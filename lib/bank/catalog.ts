import 'server-only'
import { bankFetch } from './client'
import { cbtPlanResponseSchema, examsResponseSchema, profileResponseSchema, subjectsResponseSchema, yearsResponseSchema, type CbtPlan, type Exam, type ExamProfile, type ExamSubject, type ExamYear } from './schemas'
import type { PastQUser } from '@/lib/auth/session'
import { getTier, type Tier } from '@/lib/entitlements'
const cached = { cache: 'force-cache' as const, revalidate: 300 }
// Every tier is part of the cache tag: a premium request must never be served the
// free catalog payload (or the other way round).
export async function getExams(user?: PastQUser): Promise<Exam[]> { const tier = getTier(user); return examsResponseSchema.parse(await bankFetch('/exams', {}, { tier, ...cached, tags: [`bank-exams-${tier}`] })).data }
export async function getExamProfile(exam: string, user?: PastQUser): Promise<ExamProfile> { const tier = getTier(user); return profileResponseSchema.parse(await bankFetch(`/exams/${encodeURIComponent(exam)}/profile`, {}, { tier, ...cached, tags: [`bank-profile-${exam}-${tier}`] })).data }
export async function getYears(exam: string, user?: PastQUser): Promise<ExamYear[]> { const tier = getTier(user); return yearsResponseSchema.parse(await bankFetch(`/exams/${encodeURIComponent(exam)}/years`, {}, { tier, ...cached, tags: [`bank-years-${exam}-${tier}`] })).data }
export async function getSubjects(exam: string, year: number, user?: PastQUser): Promise<{ access: 'free' | 'premium'; subjects: ExamSubject[] }> { const tier = getTier(user); return subjectsResponseSchema.parse(await bankFetch(`/exams/${encodeURIComponent(exam)}/years/${year}/subjects`, {}, { tier, ...cached, tags: [`bank-subjects-${exam}-${year}-${tier}`] })).data }
export async function getCbtPlan(exam: string, year: number, tier: Tier = 'free'): Promise<CbtPlan> { return cbtPlanResponseSchema.parse(await bankFetch(`/exams/${encodeURIComponent(exam)}/years/${year}/cbt-plan?tier=${tier}`, {}, { tier, ...cached, tags: [`bank-cbt-${exam}-${year}-${tier}`] })).data }
