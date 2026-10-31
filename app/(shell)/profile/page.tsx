import { requireUser } from '@/lib/auth/session'
import { ProfileHub } from '@/components/profile-hub'
import { getEntitlementSummary } from '@/lib/entitlements'
export default async function ProfilePage() { const { user, profile } = await requireUser(); const summary = getEntitlementSummary(user); return <ProfileHub user={user} profile={profile} planName={summary.premium ? 'Premium' : 'Free plan'} /> }
