'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { UnlockSheet } from './practice-setup'

export const practiceSetupHref = (exam: string, year: number, subject?: string) => `/practice/${exam}/${year}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`
export const cbtSetupHref = (exam: string, year: number) => `/cbt/${exam}/${year}`

export function UnlockTrigger({ signedIn, currentPath, children }: { signedIn: boolean; currentPath: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" className="year-tile locked" onClick={() => setOpen(true)} aria-label="Unlock this year">{children}</button>
    {open && <UnlockSheet signedIn={signedIn} returnPath={currentPath} onClose={() => setOpen(false)} />}
  </>
}

export function OpeningSoonButton({ href, label, signedIn }: { href: string; label: string; signedIn: boolean }) {
  const [open, setOpen] = useState(false)
  if (!signedIn) return <Link className="primary-button" href={`/sign-in?next=${encodeURIComponent(href)}`}>{label} <ArrowRight size={16} /></Link>
  return <><button className="primary-button" onClick={() => setOpen(true)}>{label} <ArrowRight size={16} /></button>{open && <div className="toast" role="status">Opening soon <button onClick={() => setOpen(false)} aria-label="Dismiss">×</button></div>}</>
}
