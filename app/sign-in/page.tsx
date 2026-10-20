import Image from 'next/image'
import { Suspense } from 'react'
import { SignInForm } from './sign-in-form'

export default function SignInPage() { return <main className="auth-page"><section className="auth-card"><Image src="/brand/pastq-wordmark.svg" alt="PastQ" width={116} height={28} /><p className="landing-kicker">PastQ account</p><h1>Welcome to PastQ</h1><p>Keep your practice progress in one calm, focused place.</p><Suspense><SignInForm /></Suspense></section></main> }
