import { NextResponse } from 'next/server'
import { assertSameOrigin } from '@/lib/auth/origin'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/auth/db'
import { sendEmail } from '@/lib/email/send'
export async function POST() { await assertSameOrigin(); const current = await getCurrentUser(); if (!current) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); await db('profiles', { method: 'PATCH', body: JSON.stringify({ onboarded_at: new Date().toISOString(), updated_at: new Date().toISOString() }) }, `?user_id=eq.${current.user.id}`); await sendEmail({ to: current.user.email, template: 'welcome', data: { firstName: current.profile.display_name || current.user.name || current.user.email.split('@')[0], exams: current.profile.target_exams || [] } }).catch(() => undefined); return NextResponse.json({ ok: true }) }
