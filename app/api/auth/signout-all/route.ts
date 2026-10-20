import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/auth/db'
import { assertSameOrigin } from '@/lib/auth/origin'
import { SESSION_COOKIE, getCurrentUser } from '@/lib/auth/session'
export async function POST() { await assertSameOrigin(); const current = await getCurrentUser(); if (current) await db('sessions', { method: 'PATCH', body: JSON.stringify({ revoked_at: new Date().toISOString() }) }, `?user_id=eq.${current.user.id}&revoked_at=is.null`); const response = NextResponse.json({ ok: true }); response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 }); return response }
