import { NextResponse } from 'next/server'
import { assertSameOrigin } from '@/lib/auth/origin'
import { getCurrentUser, SESSION_COOKIE } from '@/lib/auth/session'
import { db } from '@/lib/auth/db'
import { sendEmail } from '@/lib/email/send'
export async function DELETE(request: Request) { await assertSameOrigin(); const current = await getCurrentUser(); if (!current) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); await sendEmail({ to: current.user.email, template: 'account_deleted', data: { firstName: current.profile.display_name || current.user.name || current.user.email.split('@')[0] } }).catch(() => undefined); await db('users', { method: 'DELETE' }, `?id=eq.${current.user.id}`); const response = NextResponse.json({ ok: true }); response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 }); return response }
