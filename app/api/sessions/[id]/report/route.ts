import { NextResponse } from 'next/server'
import { assertSameOrigin } from '@/lib/auth/origin'
import { requireUser } from '@/lib/auth/session'
import { getSession } from '@/lib/study-sessions'
import { bankFetch } from '@/lib/bank/client'
const hits = new Map<string, number[]>()
const out=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}})
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){await assertSameOrigin();const {user}=await requireUser();const row=await getSession((await params).id,user.id);if(!row)return out({error:'Not found'},404);const now=Date.now();const recent=(hits.get(user.id)||[]).filter(t=>now-t<60000);if(recent.length>=20)return out({error:'Too many requests'},429);hits.set(user.id,[...recent,now]);const body=await request.json();const reason=String(body.reason||'other');const allowed=['typo','wrong_answer','missing_option','bad_image','garbled_passage','other'];if(!allowed.includes(reason))return out({error:'Invalid reason'},400);const result=await bankFetch(`/sessions/${row.bank_session_id}/reports`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ref:String(body.ref||''),reason,note:String(body.note||'').slice(0,300)})},{userId:user.id,tier:'free'});return out(result)}
