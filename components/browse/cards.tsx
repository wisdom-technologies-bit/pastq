import Link from 'next/link'
import { Building2, CalendarDays, ChevronRight, GraduationCap, Landmark, LockKeyhole, School } from 'lucide-react'
import type { Exam, ExamProfile, ExamSubject, ExamYear } from '@/lib/bank/schemas'
import { UnlockTrigger } from './browse-client'

/** Kept as a local union so this module stays safe to pull into a client bundle. */
type Tier = 'free' | 'premium'
/** The Bank decides which years are premium; only an unpaid reader sees a lock. */
const anchoredFor = (access: ExamYear['access'], tier: Tier) => access !== 'free' && tier !== 'premium'

export function ExamCard({ exam, profile, years, mode = 'practice', tier = 'free' }: { exam: Exam; profile?: ExamProfile; years?: ExamYear[]; mode?: 'practice' | 'cbt'; tier?: Tier }) {
  const summary = exam.profile.shared_timer ? `${exam.profile.subjects_required} subjects · ${exam.profile.total_minutes ?? exam.profile.default_minutes} minutes` : `${exam.profile.default_question_count} questions · ${exam.profile.default_minutes} minutes per subject`
  const href = mode === 'practice' ? `/practice/${exam.slug}` : `/cbt/${exam.slug}`
  const Icon = exam.slug.includes('jamb') ? GraduationCap : exam.slug.includes('waec') ? School : exam.slug.includes('neco') ? Landmark : Building2
  // Premium readers can open every year, so the free-years hint would be noise.
  const freeYears = tier === 'premium' ? [] : years?.filter((year) => year.access === 'free').map((year) => year.year) ?? []
  return <Link href={href} className="exam-card"><div className="exam-card-top"><div className="exam-card-icon"><Icon size={22} /></div><span className="exam-chevron"><ChevronRight size={18} /></span></div><div className="exam-card-title"><h2>{exam.name}</h2></div><div className="exam-card-format"><span className="meta-chip">{exam.profile.shared_timer ? `${exam.profile.subjects_required} subjects` : `${exam.profile.default_question_count} questions`}</span><span className="meta-chip">{exam.profile.shared_timer ? `${exam.profile.total_minutes ?? exam.profile.default_minutes} min` : `${exam.profile.default_minutes} min per subject`}</span></div><div className="exam-card-divider"/><div className="exam-card-footer"><span><CalendarDays size={16}/>{mode === 'cbt' ? `${years?.filter((year) => year.cbt?.eligible).length ?? 0} CBT-ready years` : `${years?.length ?? 0} years`}</span>{freeYears.length > 0 && <span className="free-pill"><LockKeyhole size={14}/>Free: {freeYears.join(', ')}</span>}</div></Link>
}

export function YearTile({ exam, year, signedIn, mode, tier = 'free' }: { exam: string; year: ExamYear; signedIn: boolean; mode: 'practice' | 'cbt'; tier?: Tier }) {
  const locked = anchoredFor(year.access, tier)
  // A paying reader sees a plain tile: no padlock, and no "Free" pill either.
  const marker = locked ? <span className="year-lock"><LockKeyhole size={14}/></span> : tier === 'free' && year.access === 'free' ? <span className="free-pill year-free">Free</span> : null
  const content = <><span className="year-tile-top"><strong>{year.year}</strong></span><span className="year-meta">{year.subject_count} subjects · {year.published_count} questions</span>{marker}</>
  if (locked) return <UnlockTrigger signedIn={signedIn} currentPath={`/${mode}/${exam}`}>{content}</UnlockTrigger>
  const href = mode === 'practice' ? `/practice/${exam}/${year.year}` : `/cbt/${exam}/${year.year}`
  return year.practice_ready === false ? <div className="year-tile">{content}<span className="status-pill">Limited</span></div> : <Link href={href} className="year-tile">{content}</Link>
}

export { SubjectSetupRow as SubjectRow } from './practice-setup'
