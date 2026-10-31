import 'server-only'
import { db } from '@/lib/auth/db'
import { env } from '@/lib/env'

/** Product defaults. The live amounts always come from the `pricing` row; these
 *  values only apply when that row has not been written yet. */
export const DEFAULT_PRICING = { currency: 'NGN', monthlyKobo: 250000, lifetimeKobo: 2500000 } as const

export type Pricing = { currency: string; monthlyKobo: number; lifetimeKobo: number }

const amount = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback
}

/** Reads the single pricing row. Never cached: a price change must show at once. */
export async function getPricing(): Promise<Pricing> {
  try {
    const rows = await db<Array<{ currency: string | null; monthly_amount_kobo: number | null; lifetime_amount_kobo: number | null }>>(
      'pricing',
      {},
      '?select=currency,monthly_amount_kobo,lifetime_amount_kobo&id=eq.1&limit=1',
    )
    const row = rows?.[0]
    if (!row) return { ...DEFAULT_PRICING }
    const currency = typeof row.currency === 'string' && row.currency.trim() ? row.currency.trim().toUpperCase() : DEFAULT_PRICING.currency
    return {
      currency,
      monthlyKobo: amount(row.monthly_amount_kobo, DEFAULT_PRICING.monthlyKobo),
      lifetimeKobo: amount(row.lifetime_amount_kobo, DEFAULT_PRICING.lifetimeKobo),
    }
  } catch {
    return { ...DEFAULT_PRICING }
  }
}

/** 250000 → "₦2,500". Grouped by hand so every runtime prints the same string. */
export function formatNaira(kobo: number): string {
  const parsed = Number(kobo)
  const naira = Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) / 100 : 0
  const [whole, fraction] = naira.toFixed(2).split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction === '00' ? `₦${grouped}` : `₦${grouped}.${fraction}`
}

/** Test keys are safe to expose as a hint, so the page can flag test mode. */
export function isPaystackTestMode(): boolean {
  return (env.PAYSTACK_SECRET_KEY ?? '').startsWith('sk_test_')
}
