import { NextResponse } from 'next/server'
import { assertSameOrigin } from '@/lib/auth/origin'
import { requireUser } from '@/lib/auth/session'
import { finishSession, getSession } from '@/lib/study-sessions'
export async function POST(_: Request, { params }: { params: Promise<{id:string}> }) { await assertSameOrigin(); const { user } = await requireUser(); const row = await getSession((await params).id,user.id); if(!row) return NextResponse.json({error:'Not found'},{status:404}); await finishSession(row,user); return NextResponse.json({ok:true}) }
