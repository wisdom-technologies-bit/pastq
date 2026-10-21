import Link from 'next/link'
export const SESSION_PLAY_URL = (id: string) => `/practice/session/${id}/play`
export default async function SessionPlay({ params }: { params: Promise<{id:string}> }) { const {id}=await params; return <main className="session-page focus-page"><Link href={`/practice/session/${id}`} className="back-link">← Back to session</Link><section className="session-card"><p className="eyebrow">Focus mode</p><h1>Your player is being finished.</h1><p>We&apos;re preparing the question player for this session.</p></section></main> }
