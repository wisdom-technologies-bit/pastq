import { CircleUserRound } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
export default function ProfilePage() { return <><header className="page-header simple"><div><p className="eyebrow">Profile</p><h1>Your study, your way.</h1><p className="lede">A home for your preferences and exam goals.</p></div></header><EmptyState icon={CircleUserRound} eyebrow="Your profile is private" title="Set up your learning space." description="Accounts are not open yet. For now, PastQ is ready whenever you are." /></> }
