import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/auth/db'
import { assertSameOrigin } from '@/lib/auth/origin'
import { SESSION_COOKIE } from '@/lib/auth/session'
import { createHash } from 'node:crypto'
export async function POST() { await assertSameOrigin(); const token = (await cookies()).get(SESSION_COOKIE)?.value; if (token) await db('sessions', { method: 'PATCH', body: JSON.stringify({ revoked_at: new Date().toISOString() }) }, `?token_hash=eq.${createHash('sha256').update(token).digest('hex')}`); const response = NextResponse.json({ ok: true }); response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 }); return response }
