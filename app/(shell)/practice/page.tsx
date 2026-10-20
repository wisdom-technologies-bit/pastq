import { BookOpen } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
export default function PracticePage() { return <><header className="page-header simple"><div><p className="eyebrow">Practice</p><h1>Learn at your own pace.</h1><p className="lede">Pick a subject, find your rhythm, and keep going.</p></div></header><EmptyState icon={BookOpen} eyebrow="Your library is being prepared" title="Past questions, made clearer." description="The PastQ Bank is getting ready. Your practice library will appear here when it opens." /></> }
