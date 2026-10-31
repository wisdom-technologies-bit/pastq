import type { Metadata } from 'next'
import { BannerSlot } from '@/components/banners/BannerSlot'
import { PlansView } from '@/components/plans/plans-view'
import { getCurrentUser } from '@/lib/auth/session'
import { getEntitlementSummary } from '@/lib/entitlements'
import { formatNaira, getPricing, isPaystackTestMode } from '@/lib/billing/pricing'

export const metadata: Metadata = {
  title: 'Plans',
  description: 'PastQ premium opens every year of every exam in practice and CBT. Pay monthly or once for lifetime access.',
}

/** Only same-site paths are honoured, so the `next` hop cannot be hijacked. */
const safeNext = (value?: string) => (value && value.startsWith('/') && !value.startsWith('//') ? value : null)

// This page lives outside the app shell, which owns the theme switch. Apply the
// same cookie before the first paint so dark mode never flashes light.
const THEME_SCRIPT =
  "try{var m=document.cookie.match(/(?:^|; )pastq_theme=(dark|light)/);var d=m?m[1]==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}"

export default async function PlansPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams
  const [current, pricing] = await Promise.all([getCurrentUser(), getPricing()])
  const summary = getEntitlementSummary(current?.user)

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      <PlansView
        signedIn={Boolean(current)}
        premium={summary.premium}
        testMode={isPaystackTestMode()}
        monthlyPrice={formatNaira(pricing.monthlyKobo)}
        lifetimePrice={formatNaira(pricing.lifetimeKobo)}
        next={safeNext(params.next)}
        planLabel={summary.planLabel}
        plan={summary.plan}
        statusLabel={summary.statusLabel}
        periodLabel={summary.periodLabel}
        cancelAtPeriodEnd={summary.cancelAtPeriodEnd}
      >
        <BannerSlot slot="plans_top" />
      </PlansView>
    </>
  )
}
