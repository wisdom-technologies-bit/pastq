import { notFound, redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/session'
import { getSession } from '@/lib/study-sessions'
import { bankFetch } from '@/lib/bank/client'
import { db } from '@/lib/auth/db'
import ResultsClient from '@/components/results/results-client'
export default async function ResultPage({params}:{params:Promise<{id:string}>}){const {user}=await requireUser();const row=await getSession((await params).id,user.id);if(!row)notFound();if(row.status!=='submitted'&&row.status!=='expired')redirect(`/practice/session/${row.id}/play`);let result=row.result_summary;let failed=false;try{if(!result){const remote=await bankFetch<any>(`/sessions/${row.bank_session_id}/result`,{}, {userId:user.id,tier:'free'});result=remote.data??remote;const summary={total:result!.total,answered:result!.answered,correct:result!.correct,wrong:result!.wrong,unanswered:result!.unanswered,percent:result!.percent,time_used_seconds:result!.time_used_seconds,subjects:result!.subjects,score_400:result!.score_400??null};await db('study_sessions',{method:'PATCH',body:JSON.stringify({status:'submitted',submitted_at:row.submitted_at??new Date().toISOString(),answered_count:result!.answered,result_summary:summary})},`?id=eq.${row.id}&user_id=eq.${user.id}`);result=summary}}catch{failed=true}return <ResultsClient session={row} result={result! as any} failed={failed}/>}
