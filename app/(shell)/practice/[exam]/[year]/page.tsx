import Link from 'next/link'
import { BannerSlot } from '@/components/banners/BannerSlot'
import { SubjectBrowser } from '@/components/browse/subject-browser'
import { getExamProfile, getSubjects, getYears } from '@/lib/bank/catalog'
import { getCurrentUser } from '@/lib/auth/session'
import { getTier, yearLocked } from '@/lib/entitlements'

export default async function PracticeSubjectsPage({ params }: { params: Promise<{ exam: string; year: string }> }) {
  const { exam, year: rawYear } = await params
  const year = Number(rawYear)
  const current = await getCurrentUser()
  const tier = getTier(current?.user)
  try {
    const [profile, catalog, years] = await Promise.all([getExamProfile(exam, current?.user), getSubjects(exam, year, current?.user), getYears(exam, current?.user)])
    // The Bank marks which years are premium; only an unpaid reader is locked out.
    const locked = yearLocked(years.find((item) => item.year === year)?.access, tier)
    const defaultInstant = (current as unknown as { profile?: { settings?: { instant_feedback?: boolean } } } | null)?.profile?.settings?.instant_feedback ?? true
    return (
      <>
        <BannerSlot slot="practice_top" />
        <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/practice">Practice</Link><span>/</span><Link href={`/practice/${exam}`}>{profile.display_name}</Link><span>/</span><span>{year}</span></nav>
        <header className="browse-header"><div><p className="eyebrow">{profile.display_name} · {year}</p><h1>Choose a subject.</h1><p className="lede">Pick a subject to practise at your own pace.</p></div></header>
        {locked && <div className="notice"><strong>This year is part of PastQ premium.</strong><p>You can browse the subjects below. <Link href={`/plans?next=${encodeURIComponent(`/practice/${exam}/${year}`)}`} className="text-link">See plans</Link> to practise them.</p></div>}
        <SubjectBrowser subjects={catalog.subjects} exam={exam} examName={profile.display_name} year={year} compulsory={profile.compulsory_subject_slug} signedIn={Boolean(current)} locked={locked} limits={{ min: profile.min_questions, max: profile.max_questions }} defaultInstant={defaultInstant} />
      </>
    )
  } catch {
    return <section className="empty-state" role="alert"><h1>We couldn&apos;t load this right now.</h1><p>The subjects for this year are not available yet.</p><Link href={`/practice/${exam}/${year}`} className="primary-button">Retry</Link></section>
  }
}
