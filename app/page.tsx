import { LandingPage } from '@/components/landing-page'
import { isSignedIn } from '@/lib/auth/session'
import HomePage from '@/app/(shell)/page'

export default async function Page() {
  return (await isSignedIn()) ? <HomePage /> : <LandingPage />
}
