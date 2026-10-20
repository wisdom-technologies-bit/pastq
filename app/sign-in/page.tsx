import Link from 'next/link'

export default function SignInPage() { return <main className="auth-placeholder"><Link href="/" className="auth-brand"><img src="/brand/pastq-wordmark.svg" alt="PastQ" /></Link><section><p className="landing-kicker">PastQ account</p><h1>Keep your place.</h1><p>Sign-in is opening shortly. Your practice space is being prepared.</p><Link href="/" className="secondary-button">Back to PastQ</Link></section></main> }
