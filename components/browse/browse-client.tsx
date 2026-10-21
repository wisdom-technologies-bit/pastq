'use client'

import Link from 'next/link'
import { useState } from 'react'
import { LockKeyhole, ArrowRight, X } from 'lucide-react'

export const practiceSetupHref = (exam: string, year: number, subject?: string) => `/practice/${exam}/${year}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`
export const cbtSetupHref = (exam: string, year: number) => `/cbt/${exam}/${year}`

export function UnlockTrigger({ signedIn, currentPath, children }: { signedIn: boolean; currentPath: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return <>
    <button className="year-tile locked" onClick={() => setOpen(true)} aria-label="Unlock every year">{children ?? <><span className="year-tile-top"><strong><LockKeyhole size={16} /></strong><span>Activation required</span></span><b>Unlock year</b><span className="year-meta">Premium access</span></>}</button>
    {open && <div className="unlock-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}><section className="unlock-sheet" role="dialog" aria-modal="true" aria-labelledby="unlock-title"><button className="unlock-close" onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button><div className="unlock-mark"><LockKeyhole size={22} /></div><p className="eyebrow">PastQ Premium</p><h2 id="unlock-title">Unlock every year</h2><p>Go further with the full PastQ archive.</p><ul><li>All years of every exam</li><li>CBT practice for every year</li><li>Full history across your subjects</li></ul><Link className="primary-button" href={signedIn ? '/plans' : `/sign-in?next=${encodeURIComponent(currentPath)}`} onClick={() => setOpen(false)}>{signedIn ? 'Activate premium' : 'Sign in to continue'} <ArrowRight size={16} /></Link><button className="text-button" onClick={() => setOpen(false)}>Not now</button></section></div>}
  </>
}

export function OpeningSoonButton({ href, label, signedIn }: { href: string; label: string; signedIn: boolean }) {
  const [open, setOpen] = useState(false)
  if (!signedIn) return <Link className="primary-button" href={`/sign-in?next=${encodeURIComponent(href)}`}>{label} <ArrowRight size={16} /></Link>
  return <><button className="primary-button" onClick={() => setOpen(true)}>{label} <ArrowRight size={16} /></button>{open && <div className="toast" role="status">Opening soon <button onClick={() => setOpen(false)} aria-label="Dismiss">×</button></div>}</>
}
