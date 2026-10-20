import { requireUser } from '@/lib/auth/session'
import { ProfileForm } from '@/components/profile-form'
export default async function ProfilePage(){const {user,profile}=await requireUser();return <><header className="page-header simple"><div><p className="eyebrow">Profile</p><h1>Your study, your way.</h1><p className="lede">Edit your account details and exam goals.</p></div></header><ProfileForm user={user} profile={profile}/></>}
