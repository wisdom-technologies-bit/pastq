'use client'
import Link from 'next/link'
import { useState } from 'react'
export function SessionActions({ id, canResume }: { id: string; canResume: boolean }) { const [busy,setBusy]=useState(false); const finish=async()=>{ if(!window.confirm('Finish this session?')) return; setBusy(true); await fetch(`/api/sessions/${id}/finish`,{method:'POST'}); window.location.href=`/practice/session/${id}/result` }; return <div className="session-actions"><Link className="primary-button" href={`/practice/session/${id}/play`}>{canResume?'Resume':'Start'}</Link><button className="text-button" disabled={busy} onClick={finish}>{busy?'Finishing…':'Finish session'}</button></div> }
