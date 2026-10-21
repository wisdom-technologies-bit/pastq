import Link from 'next/link'
import { BookOpen, Building2, CalendarDays, ChevronRight, GraduationCap, Landmark, LockKeyhole, School } from 'lucide-react'
import type { Exam, ExamProfile, ExamSubject, ExamYear, CbtPlan } from '@/lib/bank/schemas'
import { UnlockTrigger, OpeningSoonButton, practiceSetupHref, cbtSetupHref } from './browse-client'

export function ExamCard({ exam, profile, years, mode = 'practice' }: { exam: Exam; profile?: ExamProfile; years?: ExamYear[]; mode?: 'practice' | 'cbt' }) {
  const summary = exam.profile.shared_timer ? `${exam.profile.subjects_required} subjects · ${exam.profile.total_minutes ?? exam.profile.default_minutes} minutes` : `${exam.profile.default_question_count} questions · ${exam.profile.default_minutes} minutes per subject`
  const href = mode === 'practice' ? `/practice/${exam.slug}` : `/cbt/${exam.slug}`
  const Icon = exam.slug.includes('jamb') ? GraduationCap : exam.slug.includes('waec') ? School : exam.slug.includes('neco') ? Landmark : Building2
  const freeYears = years?.filter((year) => year.access === 'free').map((year) => year.year) ?? []
  return <Link href={href} className="exam-card"><div className="exam-card-top"><div className="exam-card-icon"><Icon size={22} /></div><span className="exam-chevron"><ChevronRight size={18} /></span></div><div className="exam-card-title"><h2>{exam.name}</h2></div><div className="exam-card-format"><span className="meta-chip">{exam.profile.shared_timer ? `${exam.profile.subjects_required} subjects` : `${exam.profile.default_question_count} questions`}</span><span className="meta-chip">{exam.profile.shared_timer ? `${exam.profile.total_minutes ?? exam.profile.default_minutes} min` : `${exam.profile.default_minutes} min per subject`}</span></div><div className="exam-card-divider"/><div className="exam-card-footer"><span><CalendarDays size={16}/>{mode === 'cbt' ? `${years?.filter((year) => year.cbt?.eligible).length ?? 0} CBT-ready years` : `${years?.length ?? 0} years`}</span>{freeYears.length > 0 && <span className="free-pill"><LockKeyhole size={14}/>Free: {freeYears.join(', ')}</span>}</div></Link>
}

export function YearTile({ exam, year, signedIn, mode }: { exam: string; year: ExamYear; signedIn: boolean; mode: 'practice' | 'cbt' }) {
  const content = <><span className="year-tile-top"><strong>{year.year}</strong></span><span className="year-meta">{year.subject_count} subjects · {year.published_count} questions</span>{year.access === 'free' ? <span className="free-pill year-free">Free</span> : <span className="year-lock"><LockKeyhole size={14}/></span>}</>
  if (year.access !== 'free') return <UnlockTrigger signedIn={signedIn} currentPath={`/${mode}/${exam}`}><button className="year-tile locked" type="button">{content}</button></UnlockTrigger>
  const href = mode === 'practice' ? `/practice/${exam}/${year.year}` : `/cbt/${exam}/${year.year}`
  return year.practice_ready === false ? <div className="year-tile">{content}<span className="status-pill">Limited</span></div> : <Link href={href} className="year-tile">{content}</Link>
}

export function SubjectRow({ subject, exam, year, compulsory, signedIn }: { subject: ExamSubject; exam: string; year: number; compulsory: boolean; signedIn: boolean }) { return <div className="subject-row"><span className="subject-chip"><BookOpen size={16} /></span><div><strong>{subject.name} {compulsory && <span className="status-pill">Compulsory</span>}</strong><span>{subject.published_count} questions {subject.passage_count > 0 && <span className="status-pill">Includes passages</span>}</span></div><span className="subject-action"><OpeningSoonButton href={practiceSetupHref(exam, year, subject.slug)} label="Practise" signedIn={signedIn} /></span></div> }

export function MissingCompulsory({ plan, exam, year }: { plan: CbtPlan; exam: string; year: number }) { if (!plan.missing) return null; return <div className="missing-notice"><strong>{plan.compulsorySubject === 'english-language' ? 'English' : plan.compulsorySubject} is not available for this year yet</strong><p>Choose how you want to build this CBT.</p><label><input type="radio" name="missing-compulsory" defaultChecked /> Continue without it</label>{plan.borrow?.available && <label><input type="radio" name="missing-compulsory" /> Borrow it from {plan.borrow.donorYear}</label>}</div> }

export function StartCbt({ exam, year, signedIn }: { exam: string; year: number; signedIn: boolean }) { return <OpeningSoonButton href={cbtSetupHref(exam, year)} label="Start CBT" signedIn={signedIn} /> }
