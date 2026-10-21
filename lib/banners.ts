export type Banner = { id: string; slot: 'home_top' | 'practice_top' | 'cbt_top' | 'plans_top' | 'results_bottom'; desktopImage: string; mobileImage: string; alt: string; href: string; startsAt?: string; endsAt?: string }
// Add uploaded /public/banners assets here. Active dates are optional ISO timestamps.
export const banners: Banner[] = []
export function getActiveBanners(slot: Banner['slot'], now = new Date()) { return banners.filter((banner) => banner.slot === slot && (!banner.startsAt || new Date(banner.startsAt) <= now) && (!banner.endsAt || new Date(banner.endsAt) >= now)) }
