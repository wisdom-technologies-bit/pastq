import { NextResponse } from 'next/server'
import { createHmac, randomInt } from 'node:crypto'
import { z } from 'zod'
import { assertSameOrigin } from '@/lib/auth/origin'
import { db, rpc } from '@/lib/auth/db'
import { sendEmail } from '@/lib/email/send'
const schema = z.object({ email: z.string().trim().toLowerCase().email() })
const digest = (code: string) => createHmac('sha256', process.env.AUTH_SECRET!).update(code).digest('hex')
export async function POST(request: Request) { try { await assertSameOrigin(); const { email } = schema.parse(await request.json()); const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'; const allowed = await Promise.all([rpc<boolean>('check_rate_limit', { p_key: `email:${email}`, p_max: 5, p_window_seconds: 3600 }), rpc<boolean>('check_rate_limit', { p_key: `ip:${ip}`, p_max: 20, p_window_seconds: 3600 }), rpc<boolean>('check_rate_limit', { p_key: `cooldown:${email}`, p_max: 1, p_window_seconds: 30 })]); if (allowed.some((item) => item === false)) return NextResponse.json({ ok: true }); const code = String(randomInt(100000, 1000000)); await db('auth_codes', { method: 'POST', body: JSON.stringify({ email, code_hash: digest(code), expires_at: new Date(Date.now() + 600000).toISOString(), ip }) }); await sendEmail({ to: email, template: 'sign_in_code', data: { code } }); return NextResponse.json({ ok: true }) } catch { return NextResponse.json({ ok: true }) } }
