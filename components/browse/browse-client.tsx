'use client'

import { useState } from 'react'
import { UnlockSheet } from './practice-setup'

export const practiceSetupHref = (exam: string, year: number, subject?: string) => `/practice/${exam}/${year}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`

export function UnlockTrigger({ signedIn, currentPath, children }: { signedIn: boolean; currentPath: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" className="year-tile locked" onClick={() => setOpen(true)} aria-label="Unlock this year">{children}</button>
    {open && <UnlockSheet signedIn={signedIn} returnPath={currentPath} onClose={() => setOpen(false)} />}
  </>
}
