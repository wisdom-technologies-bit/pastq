import { Target } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
export default function CBTPage() { return <><header className="page-header simple"><div><p className="eyebrow">CBT mode</p><h1>Practice under pressure.</h1><p className="lede">A focused exam room for when you want to see what you know.</p></div></header><EmptyState icon={Target} eyebrow="Exam room locked" title="Your first mock is on its way." description="Timed practice, clear feedback, and no distractions. We&apos;re setting the room now." /></> }
