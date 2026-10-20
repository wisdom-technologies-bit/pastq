import { NextResponse } from 'next/server'
import { generateCode, hashCode, normalizeEmail } from '@/lib/auth/crypto'
import { getSupabaseAdmin } from '@/lib/auth/supabase'
import { sendEmail } from '@/lib/email/send'
import { codeEmail } from '@/lib/email/templates/code'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})); const email = normalizeEmail(String(body.email || ''))
  const generic = NextResponse.json({ ok: true })
  if (!/^\S+@\S+\.\S+$/.test(email)) return generic
  const code = generateCode(); const db = getSupabaseAdmin()
  await db.from('auth_codes').update({ consumed_at: new Date().toISOString() }).eq('email', email).is('consumed_at', null)
  await db.from('auth_codes').insert({ email, code_hash: hashCode(code), expires_at: new Date(Date.now() + 600000).toISOString(), ip: request.headers.get('x-forwarded-for')?.split(',')[0] || null })
  try { const mail = codeEmail(code); await sendEmail({ to: email, subject: mail.subject, text: mail.text, html: mail.html }) } catch { /* keep enumeration-resistant response */ }
  return generic
}
