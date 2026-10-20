import { SignInForm } from '@/components/sign-in-form'
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) { const params = await searchParams; const next = params.next?.startsWith('/') && !params.next.startsWith('//') ? params.next : '/app'; return <SignInForm next={next} /> }
