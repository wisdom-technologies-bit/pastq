import { BannerSlot } from '@/components/banners/BannerSlot'
import { ExamCard } from '@/components/browse/cards'
import { getExams, getYears } from '@/lib/bank/catalog'
import { getCurrentUser } from '@/lib/auth/session'

export default async function PracticePage() {
  const current = await getCurrentUser()
  try {
    const exams = await getExams(current?.user)
    const years = await Promise.all(exams.map((exam) => getYears(exam.slug, current?.user)))
    return <><BannerSlot slot="practice_top" /><header className="browse-header"><div><p className="eyebrow">Practice</p><h1>Learn at your own pace.</h1><p className="lede">Pick an exam, find a year, and build confidence one subject at a time.</p></div></header><div className="browse-grid">{exams.map((exam, index) => <ExamCard key={exam.slug} exam={exam} years={years[index]} />)}</div></>
  } catch { return <section className="empty-state" role="alert"><p className="eyebrow">Practice</p><h1>We couldn&apos;t load this right now.</h1><p>Give it another try and we&apos;ll fetch your exam library again.</p><a className="primary-button" href="/practice">Retry</a></section> }
}
