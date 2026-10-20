import Link from 'next/link'
export default function NotFound() { return <main className="error-state"><span className="eyebrow">404</span><h1>That page took a wrong turn.</h1><p>Let&apos;s get you back to your study desk.</p><Link className="primary-button" href="/">Back home</Link></main> }
