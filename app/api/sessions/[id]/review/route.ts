import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { getTier } from '@/lib/entitlements'
import { getSession } from '@/lib/study-sessions'
import { bankFetch } from '@/lib/bank/client'
export async function GET(request: Request,{params}:{params:Promise<{id:string}>}){const {user}=await requireUser();const {id}=await params;const row=await getSession(id,user.id);if(!row)return NextResponse.json({error:'Not found'},{status:404});const url=new URL(request.url);const from=Math.max(1,Number(url.searchParams.get('from')||1));const limit=Math.min(30,Math.max(1,Number(url.searchParams.get('limit')||30)));const body=await bankFetch(`/sessions/${row.bank_session_id}/review?from=${from}&limit=${limit}`,{}, {userId:user.id,tier:getTier(user)});return NextResponse.json(body,{headers:{'Cache-Control':'private, no-store'}})}
