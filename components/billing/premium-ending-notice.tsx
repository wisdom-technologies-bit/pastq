import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { calendarDate } from '@/lib/dates'
import { getEntitlementSummary } from '@/lib/entitlements'
import type { PastQUser } from '@/lib/auth/session'
import './billing-notice.css'

const DAY = 86_400_000

/** One slim line on the study desk, and only for people whose paid time is
 *  actually about to run out: hand-paid months and plans already switched off. */
export function PremiumEndingNotice({ user }: { user: PastQUser }) {
  const summary = getEntitlementSummary(user)
  if (!summary.premium || summary.lifetime || !summary.endsAt) return null

  const ending = summary.plan === 'monthly_manual' || summary.cancelAtPeriodEnd || summary.status === 'cancelled'
  if (!ending) return null

  const left = Date.parse(summary.endsAt) - Date.now()
  if (!(left > 0 && left <= 3 * DAY)) return null

  return (
    <p className="billing-notice">
      <span>Premium ends on {calendarDate(summary.endsAt)}.</span>
      <Link href="/profile/subscription">Renew <ArrowRight size={14} aria-hidden="true" /></Link>
    </p>
  )
}
