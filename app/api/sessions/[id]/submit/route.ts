import { NextResponse } from 'next/server'
import { assertSameOrigin } from '@/lib/auth/origin'
import { requireUser } from '@/lib/auth/session'
import { getSession } from '@/lib/study-sessions'
import { bankFetch } from '@/lib/bank/client'
import { db } from '@/lib/auth/db'
function out(body: unknown,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}})}
export async function POST(_:Request,{params}:{params:Promise<{id:string}>}){await assertSameOrigin();const {user}=await requireUser();const row=await getSession((await params).id,user.id);if(!row)return out({error:'Not found'},404);if(row.status==='submitted'||row.status==='expired')return out({data:row.result_summary});const result=await bankFetch<any>(`/sessions/${row.bank_session_id}/submit`,{method:'POST',body:'{}'},{userId:user.id,tier:'free'});const data=result.data??result;await db('study_sessions',{method:'PATCH',body:JSON.stringify({status:'submitted',submitted_at:new Date().toISOString(),result_summary:data,last_activity_at:new Date().toISOString()})},`?id=eq.${row.id}&user_id=eq.${user.id}`);return out(result)}
