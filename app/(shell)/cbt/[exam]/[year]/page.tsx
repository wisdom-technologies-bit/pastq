import Link from 'next/link'
import { BannerSlot } from '@/components/banners/BannerSlot'
import { CbtSetup, type SetupSubject } from '@/components/cbt/cbt-setup'
import { getCbtPlan, getExamProfile, getSubjects } from '@/lib/bank/catalog'
import type { ExamProfile, ExamSubject } from '@/lib/bank/schemas'
import { getCurrentUser } from '@/lib/auth/session'
import { getTier } from '@/lib/entitlements'

const prettyName = (slug: string | null | undefined) => {
  if (!slug) return 'The compulsory subject'
  if (slug === 'english-language') return 'English'
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const countFor = (profile: ExamProfile, subject: ExamSubject | undefined, slug: string | null) => {
  const override = profile.subjects.find((entry) => entry.subject_slug === slug)?.question_count
  const base = override ?? profile.default_question_count
  return subject ? Math.min(base, subject.published_count) : base
}

export default async function CbtSetupPage({ params }: { params: Promise<{ exam: string; year: string }> }) {
  const { exam, year: rawYear } = await params
  const year = Number(rawYear)
  const current = await getCurrentUser()
  const tier = getTier(current?.user)

  try {
    const [profile, plan, catalog] = await Promise.all([
      getExamProfile(exam, current?.user),
      getCbtPlan(exam, year, tier),
      getSubjects(exam, year, current?.user),
    ])

    const qualifying = new Set(plan.qualifyingSubjects)
    const compulsorySlug = profile.compulsory_subject_slug ?? plan.compulsorySubject ?? null
    const subjects: SetupSubject[] = catalog.subjects
      .filter((subject) => qualifying.has(subject.slug))
      .map((subject) => {
        const override = profile.subjects.find((entry) => entry.subject_slug === subject.slug)?.question_count
        return {
          slug: subject.slug,
          name: subject.name,
          publishedCount: subject.published_count,
          questionCount: Math.min(override ?? profile.default_question_count, subject.published_count),
        }
      })
      .filter((subject) => subject.questionCount > 0)

    const compulsorySubject = catalog.subjects.find((subject) => subject.slug === compulsorySlug)
    const compulsoryListable = subjects.some((subject) => subject.slug === compulsorySlug)
    const missingName = prettyName(plan.compulsorySubject ?? compulsorySlug)

    return (
      <>
        <BannerSlot slot="cbt_top" />
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/cbt">CBT</Link>
          <span>/</span>
          <Link href={`/cbt/${exam}`}>{profile.display_name}</Link>
          <span>/</span>
          <span>{year}</span>
        </nav>
        <CbtSetup
          exam={exam}
          examName={profile.display_name}
          year={year}
          signedIn={Boolean(current)}
          activated={tier === 'premium'}
          subjects={subjects}
          compulsorySlug={plan.missing || !compulsoryListable ? null : compulsorySlug}
          compulsoryName={compulsorySubject?.name ?? prettyName(compulsorySlug)}
          compulsoryCount={countFor(profile, compulsorySubject, compulsorySlug)}
          missing={plan.missing}
          missingName={missingName}
          borrow={plan.borrow ? { available: plan.borrow.available, donorYear: plan.borrow.donorYear, requiresActivation: plan.borrow.requiresActivation } : null}
          minSubjects={plan.minSubjects}
          maxSubjects={plan.maxSubjects}
          subjectsRequired={profile.subjects_required}
          sharedTimer={profile.shared_timer}
          totalMinutes={profile.total_minutes}
          defaultMinutes={profile.default_minutes}
          scoredOutOf400={exam.toLowerCase().includes('jamb')}
          nextPath={`/cbt/${exam}/${year}`}
        />
      </>
    )
  } catch {
    return (
      <section className="empty-state" role="alert">
        <h1>We couldn&apos;t load this right now.</h1>
        <p>The CBT plan is not available yet.</p>
        <Link href={`/cbt/${exam}/${year}`} className="primary-button">
          Retry
        </Link>
      </section>
    )
  }
}
