import { ChartNoAxesColumnIncreasing } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
export default function ProgressPage() { return <><header className="page-header simple"><div><p className="eyebrow">Progress</p><h1>Every session counts.</h1><p className="lede">Your learning story will take shape here.</p></div></header><EmptyState icon={ChartNoAxesColumnIncreasing} eyebrow="Nothing to show yet" title="Your progress starts with one session." description="Complete a practice set and we&apos;ll help you see what&apos;s working." /></> }
