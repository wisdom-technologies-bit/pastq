import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createHash, randomBytes } from 'node:crypto'
import { db } from './db'
import { isPremium } from '@/lib/entitlements'

export const SESSION_COOKIE = '__Host-pastq_session'
const DAYS = 30
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const expiry = () => new Date(Date.now() + DAYS * 86400000).toISOString()

/** Billing state the session needs to answer `getTier` without another query.
 *  The Paystack tokens stay on the server and are never selected here. */
export type PastQEntitlement = { plan: 'monthly_auto' | 'monthly_manual' | 'lifetime'; status: 'active' | 'past_due' | 'cancelled' | 'expired'; current_period_end: string | null; cancel_at_period_end: boolean; started_at?: string | null }
export type PastQUser = { id: string; email: string; name: string | null; avatar_url: string | null; status: 'active' | 'disabled'; email_verified_at: string | null; google_sub?: string | null; premium?: boolean; entitlement?: PastQEntitlement | null }
export type PastQProfile = { user_id: string; display_name: string | null; target_exams: string[]; exam_year: number | null; onboarded_at: string | null; settings?: { theme?: 'light' | 'dark' | 'system'; text_size?: 'small' | 'medium' | 'large'; instant_feedback?: boolean }; product_updates?: boolean }

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url')
  const h = await headers()
  await db('sessions', { method: 'POST', body: JSON.stringify({ user_id: userId, token_hash: hash(token), expires_at: expiry(), user_agent: h.get('user-agent'), ip: h.get('x-forwarded-for')?.split(',')[0] || null }) })
  const jar = await cookies(); jar.set(SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: DAYS * 86400 })
}

/** Billing must never block sign-in: a missing row or a failed read is simply free. */
async function loadEntitlement(userId: string): Promise<PastQEntitlement | null> {
  try {
    const rows = await db<PastQEntitlement[]>('entitlements', {}, `?select=plan,status,current_period_end,cancel_at_period_end,started_at&user_id=eq.${userId}&limit=1`)
    return rows?.[0] ?? null
  } catch {
    return null
  }
}

export async function getCurrentUser(): Promise<{ user: PastQUser; profile: PastQProfile } | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  const sessions = await db<Array<{ user_id: string; last_seen_at: string; expires_at: string }>>('sessions', {}, `?select=user_id,last_seen_at,expires_at&token_hash=eq.${hash(token)}&revoked_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`)
  const session = sessions[0]
  if (!session) return null
  const users = await db<PastQUser[]>('users', {}, `?select=id,email,name,avatar_url,status,email_verified_at,google_sub&id=eq.${session.user_id}&status=eq.active&limit=1`)
  const found = users[0]; if (!found) return null
  if (Date.now() - new Date(session.last_seen_at).getTime() > 3600000) await db('sessions', { method: 'PATCH', body: JSON.stringify({ last_seen_at: new Date().toISOString() }) }, `?token_hash=eq.${hash(token)}`)
  const profiles = await db<PastQProfile[]>('profiles', {}, `?select=user_id,display_name,target_exams,exam_year,onboarded_at,settings,product_updates&user_id=eq.${found.id}&limit=1`)
  const entitlement = await loadEntitlement(found.id)
  const user: PastQUser = { ...found, entitlement, premium: isPremium(entitlement, found.email) }
  return { user, profile: profiles[0] || { user_id: user.id, display_name: null, target_exams: [], exam_year: null, onboarded_at: null, settings: { instant_feedback: true } } }
}

export async function isSignedIn() { return Boolean(await getCurrentUser()) }
export async function requireUser() { const current = await getCurrentUser(); if (!current) redirect(`/sign-in?next=${encodeURIComponent((await headers()).get('x-pathname') || '/app')}`); return current }
export function clearSessionCookie() { return cookies().then((jar) => jar.set(SESSION_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })) }
