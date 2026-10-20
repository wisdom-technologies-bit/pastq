import { headers } from 'next/headers'
export async function assertSameOrigin() { const h = await headers(); const origin = h.get('origin'); const host = h.get('host'); if (origin && new URL(origin).host !== host) throw new Error('Invalid origin') }
