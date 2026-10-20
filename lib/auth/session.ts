import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createHash, randomBytes } from 'node:crypto'
import { db } from './db'

export const SESSION_COOKIE = '__Host-pastq_session'
const DAYS = 30
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const expiry = () => new Date(Date.now() + DAYS * 86400000).toISOString()

export type PastQUser = { id: string; email: string; name: string | null; avatar_url: string | null; status: 'active' | 'disabled'; email_verified_at: string | null }
export type PastQProfile = { user_id: string; display_name: string | null; target_exams: string[]; exam_year: number | null; onboarded_at: string | null }

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url')
  const h = await headers()
  await db('sessions', { method: 'POST', body: JSON.stringify({ user_id: userId, token_hash: hash(token), expires_at: expiry(), user_agent: h.get('user-agent'), ip: h.get('x-forwarded-for')?.split(',')[0] || null }) })
  const jar = await cookies(); jar.set(SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: DAYS * 86400 })
}

export async function getCurrentUser(): Promise<{ user: PastQUser; profile: PastQProfile } | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  const sessions = await db<Array<{ user_id: string; last_seen_at: string; expires_at: string }>>('sessions', {}, `?select=user_id,last_seen_at,expires_at&token_hash=eq.${hash(token)}&revoked_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`)
  const session = sessions[0]
  if (!session) return null
  const users = await db<PastQUser[]>('users', {}, `?select=id,email,name,avatar_url,status,email_verified_at&id=eq.${session.user_id}&status=eq.active&limit=1`)
  const user = users[0]; if (!user) return null
  if (Date.now() - new Date(session.last_seen_at).getTime() > 3600000) await db('sessions', { method: 'PATCH', body: JSON.stringify({ last_seen_at: new Date().toISOString() }) }, `?token_hash=eq.${hash(token)}`)
  const profiles = await db<PastQProfile[]>('profiles', {}, `?select=user_id,display_name,target_exams,exam_year,onboarded_at&user_id=eq.${user.id}&limit=1`)
  return { user, profile: profiles[0] || { user_id: user.id, display_name: null, target_exams: [], exam_year: null, onboarded_at: null } }
}

export async function isSignedIn() { return Boolean(await getCurrentUser()) }
export async function requireUser() { const current = await getCurrentUser(); if (!current) redirect(`/sign-in?next=${encodeURIComponent((await headers()).get('x-pathname') || '/app')}`); return current }
export function clearSessionCookie() { return cookies().then((jar) => jar.set(SESSION_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })) }
