import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createHash } from 'node:crypto'
import { getSupabaseAdmin } from '@/lib/auth/supabase'
import { SESSION_COOKIE } from '@/lib/auth/session'
export async function POST() { const jar=await cookies(); const token=jar.get(SESSION_COOKIE)?.value; if(token) await getSupabaseAdmin().from('sessions').update({revoked_at:new Date().toISOString()}).eq('token_hash',createHash('sha256').update(token).digest('hex')); jar.delete(SESSION_COOKIE); return NextResponse.json({ok:true}) }
