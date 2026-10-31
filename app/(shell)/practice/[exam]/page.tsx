import Link from 'next/link'
import { BannerSlot } from '@/components/banners/BannerSlot'
import { YearTile } from '@/components/browse/cards'
import { getExamProfile, getYears } from '@/lib/bank/catalog'
import { getCurrentUser } from '@/lib/auth/session'
import { getTier, yearLocked } from '@/lib/entitlements'

export default async function PracticeExamPage({ params }: { params: Promise<{ exam: string }> }) {
  const { exam } = await params
  const current = await getCurrentUser()
  const tier = getTier(current?.user)

  try {
    const [profile, years] = await Promise.all([getExamProfile(exam, current?.user), getYears(exam, current?.user)])
    const header = <><BannerSlot slot="practice_top" /><nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/practice">Practice</Link><span>/</span><span>{profile.display_name}</span></nav><header className="browse-header"><div><p className="eyebrow">Practice</p><h1>{profile.display_name}</h1><p className="lede">Choose a year and start with focused questions.</p></div></header></>

    // A paying reader sees one plain grid: every year is open, so the free and
    // premium headings would only repeat themselves.
    if (tier === 'premium') {
      return <>{header}<div className="year-grid">{years.map((year) => <YearTile key={year.year} exam={exam} year={year} signedIn={Boolean(current)} mode="practice" tier={tier} />)}</div></>
    }

    const open = years.filter((year) => !yearLocked(year.access, tier))
    const locked = years.filter((year) => yearLocked(year.access, tier))
    return <>{header}<div className="year-groups">{open.length > 0 && <section className="year-group"><h2>Free</h2><div className="year-grid">{open.map((year) => <YearTile key={year.year} exam={exam} year={year} signedIn={Boolean(current)} mode="practice" tier={tier} />)}</div></section>}{locked.length > 0 && <section className="year-group"><h2>Premium</h2><div className="year-grid">{locked.map((year) => <YearTile key={year.year} exam={exam} year={year} signedIn={Boolean(current)} mode="practice" tier={tier} />)}</div></section>}</div></>
  } catch {
    return <section className="empty-state" role="alert"><h1>We couldn&apos;t load this right now.</h1><p>Your exam years will be here shortly.</p><Link href={`/practice/${exam}`} className="primary-button">Retry</Link></section>
  }
}
