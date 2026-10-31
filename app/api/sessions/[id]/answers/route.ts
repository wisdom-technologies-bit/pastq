import { NextResponse } from 'next/server'
import { assertSameOrigin } from '@/lib/auth/origin'
import { requireUser } from '@/lib/auth/session'
import { getTier } from '@/lib/entitlements'
import { getSession } from '@/lib/study-sessions'
import { bankFetch } from '@/lib/bank/client'
import { db } from '@/lib/auth/db'
const hits = new Map<string, number[]>()
function out(body: unknown, status=200) { return NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}}) }
export async function PUT(request: Request,{params}:{params:Promise<{id:string}>}) { await assertSameOrigin(); const {user}=await requireUser(); const row=await getSession((await params).id,user.id); if(!row)return out({error:'Not found'},404); const now=Date.now(); const recent=(hits.get(user.id)||[]).filter((t)=>now-t<60000); if(recent.length>=120)return out({error:'Too many requests'},429); hits.set(user.id,[...recent,now]); const payload=await request.json(); const result=await bankFetch(`/sessions/${row.bank_session_id}/answers`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)},{userId:user.id,tier:getTier(user)}); const progress=await bankFetch<any>(`/sessions/${row.bank_session_id}`,{}, {userId:user.id,tier:getTier(user)}); const data=progress.data??progress; await db('study_sessions',{method:'PATCH',body:JSON.stringify({answered_count:data.progress?.answered??data.answered_count??row.answered_count,last_activity_at:new Date().toISOString()})},`?id=eq.${row.id}&user_id=eq.${user.id}`); return out(result) }
