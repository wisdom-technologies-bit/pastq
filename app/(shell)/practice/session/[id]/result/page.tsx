import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth/session'
import { getSession } from '@/lib/study-sessions'
export default async function SessionResult({params}:{params:Promise<{id:string}>}) { const {user}=await requireUser(); const row=await getSession((await params).id,user.id); if(!row) notFound(); const result=row.result_summary??{}; return <main className="session-page"><Link href={`/practice/session/${row.id}`} className="back-link">← Back to session</Link><section className="session-card result-summary"><p className="eyebrow">Results</p><h1>{row.exam_name} {row.exam_year}</h1><p className="result-score">{String(result.score_percent??0)}%</p><p>{String(result.correct??0)} correct · {String(result.wrong??0)} wrong · {String(result.unanswered??0)} unanswered</p><Link className="primary-button" href="/practice">Back to practice</Link></section></main> }
