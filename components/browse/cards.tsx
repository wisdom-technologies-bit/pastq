import Link from 'next/link'
import { BookOpen, ChevronRight, LockKeyhole, Target } from 'lucide-react'
import type { Exam, ExamProfile, ExamSubject, ExamYear, CbtPlan } from '@/lib/bank/schemas'
import { UnlockTrigger, OpeningSoonButton, practiceSetupHref, cbtSetupHref } from './browse-client'

export function ExamCard({ exam, profile, years, mode = 'practice' }: { exam: Exam; profile?: ExamProfile; years?: ExamYear[]; mode?: 'practice' | 'cbt' }) {
  const summary = exam.profile.shared_timer ? `${exam.profile.subjects_required} subjects · ${exam.profile.total_minutes ?? exam.profile.default_minutes} minutes` : `${exam.profile.default_question_count} questions · ${exam.profile.default_minutes} minutes per subject`
  const href = mode === 'practice' ? `/practice/${exam.slug}` : `/cbt/${exam.slug}`
  return <Link href={href} className="exam-card"><div className="exam-card-icon"><BookOpen size={21} /></div><div className="exam-card-body"><div className="exam-card-title"><h2>{exam.name}</h2><ChevronRight size={18} /></div><p>{summary}</p>{years?.length ? <span className="exam-card-meta">{years.length} years of past questions</span> : null}{years?.some((year) => year.access === 'free') ? <span className="exam-card-free">Free: {years.filter((year) => year.access === 'free').map((year) => year.year).join(', ')}</span> : null}</div></Link>
}

export function YearTile({ exam, year, signedIn, mode }: { exam: string; year: ExamYear; signedIn: boolean; mode: 'practice' | 'cbt' }) {
  if (year.access !== 'free') return <UnlockTrigger signedIn={signedIn} currentPath={`/${mode}/${exam}`} />
  const href = mode === 'practice' ? `/practice/${exam}/${year.year}` : `/cbt/${exam}/${year.year}`
  return <Link href={href} className="year-tile"><span className="year-tile-top"><strong>{year.year}</strong><span>Free</span></span><span className="year-meta">{year.subject_count} subjects · {year.published_count} questions</span></Link>
}

export function SubjectRow({ subject, exam, year, compulsory, signedIn }: { subject: ExamSubject; exam: string; year: number; compulsory: boolean; signedIn: boolean }) { return <div className="subject-row"><span className="subject-chip"><BookOpen size={16} /></span><div><strong>{subject.name}</strong><span>{subject.published_count} questions</span></div><OpeningSoonButton href={practiceSetupHref(exam, year, subject.slug)} label="Practise" signedIn={signedIn} /></div> }

export function MissingCompulsory({ plan, exam, year }: { plan: CbtPlan; exam: string; year: number }) { if (!plan.missing) return null; return <div className="missing-notice"><strong>{plan.compulsorySubject === 'english-language' ? 'English' : plan.compulsorySubject} is not available for this year yet</strong><p>Choose how you want to build this CBT.</p><label><input type="radio" name="missing-compulsory" defaultChecked /> Continue without it</label>{plan.borrow?.available && <label><input type="radio" name="missing-compulsory" /> Borrow it from {plan.borrow.donorYear}</label>}</div> }

export function StartCbt({ exam, year, signedIn }: { exam: string; year: number; signedIn: boolean }) { return <OpeningSoonButton href={cbtSetupHref(exam, year)} label="Start CBT" signedIn={signedIn} /> }
