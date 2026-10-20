import { NextResponse } from 'next/server'
import { createSession } from '@/lib/auth/session'
import { getSupabaseAdmin } from '@/lib/auth/supabase'
import { hashCode, normalizeEmail, safeEqual, safeNext } from '@/lib/auth/crypto'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})); const email = normalizeEmail(String(body.email || '')); const code = String(body.code || '')
  const db = getSupabaseAdmin(); const { data: row } = await db.from('auth_codes').select('id,code_hash,expires_at,attempts,consumed_at').eq('email', email).is('consumed_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!row || row.attempts >= 5 || new Date(row.expires_at) < new Date() || !/^\d{6}$/.test(code) || !safeEqual(row.code_hash, hashCode(code))) return NextResponse.json({ error: 'That code is incorrect or expired.' }, { status: 400 })
  await db.from('auth_codes').update({ consumed_at: new Date().toISOString() }).eq('id', row.id)
  let { data: user } = await db.from('users').select('id').eq('email', email).maybeSingle()
  if (!user) { const created = await db.from('users').insert({ email, email_verified_at: new Date().toISOString(), last_login_at: new Date().toISOString() }).select('id').single(); user = created.data }
  if (!user) return NextResponse.json({ error: 'Unable to sign you in.' }, { status: 500 })
  await db.from('profiles').upsert({ user_id: user.id }, { onConflict: 'user_id' }); await createSession(user.id)
  return NextResponse.json({ ok: true, next: safeNext(String(body.next || '')) })
}
