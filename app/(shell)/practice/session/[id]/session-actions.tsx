'use client'
import Link from 'next/link'
export function SessionActions({id,canResume}:{id:string;canResume:boolean}){return <div className="session-actions"><Link className="primary-button" href={`/practice/session/${id}/play`}>{canResume?'Resume':'Start'}</Link><Link className="secondary-button" href="/practice">Finish session</Link></div>}
