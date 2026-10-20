import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/auth/db'
import { assertSameOrigin } from '@/lib/auth/origin'
const schema = z.object({ display_name: z.string().trim().max(80), target_exams: z.array(z.enum(['JAMB','WAEC','NECO','Post-UTME'])).max(4), exam_year: z.number().int().min(2000).max(2100).nullable() })
export async function PATCH(request: Request) { await assertSameOrigin(); const current = await getCurrentUser(); if (!current) return NextResponse.json({ error: 'Sign in required' }, { status: 401 }); const values = schema.parse(await request.json()); await db('profiles', { method: 'PATCH', body: JSON.stringify({ ...values, onboarded_at: new Date().toISOString(), updated_at: new Date().toISOString() }) }, `?user_id=eq.${current.user.id}`); await db('users', { method: 'PATCH', body: JSON.stringify({ name: values.display_name }) }, `?id=eq.${current.user.id}`); return NextResponse.json({ ok: true }) }
