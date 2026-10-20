import { cookies } from 'next/headers'
import { createHash, randomBytes } from 'node:crypto'
import { redirect } from 'next/navigation'
import { getSupabaseAdmin } from '@/lib/auth/supabase'

export const SESSION_COOKIE = '__Host-pastq_session'
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url')
  const db = getSupabaseAdmin()
  await db.from('sessions').insert({ user_id: userId, token_hash: hash(token), expires_at: new Date(Date.now()+30*86400000).toISOString() })
  const jar = await cookies(); jar.set(SESSION_COOKIE, token, { httpOnly:true, secure:true, sameSite:'lax', path:'/', maxAge:30*86400 })
}
export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  const db = getSupabaseAdmin()
  const { data: session } = await db.from('sessions').select('id,user_id,expires_at,revoked_at,last_seen_at').eq('token_hash',hash(token)).maybeSingle()
  if (!session || session.revoked_at || new Date(session.expires_at) <= new Date()) return null
  if (Date.now()-new Date(session.last_seen_at).getTime() > 3600000) await db.from('sessions').update({last_seen_at:new Date().toISOString(),expires_at:new Date(Date.now()+30*86400000).toISOString()}).eq('id',session.id)
  const { data: user } = await db.from('users').select('id,email,name,avatar_url,email_verified_at,status').eq('id',session.user_id).maybeSingle()
  if (!user || user.status !== 'active') return null
  const { data: profile } = await db.from('profiles').select('user_id,display_name,target_exams,exam_year,onboarded_at').eq('user_id',user.id).maybeSingle()
  return { user, profile }
}
export async function isSignedIn() { return Boolean(await getCurrentUser()) }
export async function requireUser(next = '/app') { const current = await getCurrentUser(); if (!current) redirect(`/sign-in?next=${encodeURIComponent(next)}`); return current }
