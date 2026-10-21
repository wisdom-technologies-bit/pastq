import { requireUser } from '@/lib/auth/session'
import { ProfileHub } from '@/components/profile-hub'
export default async function ProfilePage() { const { user, profile } = await requireUser(); return <ProfileHub user={user} profile={profile} /> }
