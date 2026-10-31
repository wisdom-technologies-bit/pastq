'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, ChevronRight, CircleHelp, CreditCard, History, KeyRound, LogOut, Palette, Shield, SlidersHorizontal, Trash2, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { PastQProfile, PastQUser } from '@/lib/auth/session'

export const profileSections = [
  { href: '/profile/edit', label: 'Edit profile', icon: UserRound },
  { href: '/profile/security', label: 'Account security', icon: Shield },
  { href: '/profile/subscription', label: 'Subscription', icon: CreditCard },
  { href: '/profile/settings', label: 'Settings', icon: SlidersHorizontal },
  { href: '/profile/help', label: 'Help and support', icon: CircleHelp },
  { href: '/legal/terms', label: 'Terms of use', icon: KeyRound },
  { href: '/legal/privacy', label: 'Privacy policy', icon: KeyRound },
]
const groups = [{ title: 'Account', items: [...profileSections.slice(0, 3), { href: '/progress/history', label: 'History', icon: History }] }, { title: 'Preferences', items: profileSections.slice(3, 4) }, { title: 'Help', items: profileSections.slice(4) }]

function Avatar({ user, name }: { user: PastQUser; name?: string | null }) { const initials = (name || user.name || user.email).split(/\\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(); return user.avatar_url ? <img className="profile-avatar" src={user.avatar_url} alt="" /> : <span className="profile-avatar">{initials}</span> }
export function PageHeader({ title, description, back = true }: { title: string; description?: string; back?: boolean }) { const router = useRouter(); return <header className={`profile-page-header${back ? ' with-back' : ' no-back'}`}>{back && <button className="icon-button" onClick={() => router.back()} aria-label="Go back"><ArrowLeft /></button>}<div><h1>{title}</h1>{description && <p>{description}</p>}</div></header> }
export function ProfileRow({ href, icon: Icon, label, value, danger = false }: { href?: string; icon: typeof UserRound; label: string; value?: string; danger?: boolean }) { const content = <>{<span className={`row-icon${danger ? ' danger' : ''}`}><Icon /></span>}<span className="row-label">{label}</span>{value && <span className="row-value">{value}</span>}{href && <ChevronRight className="row-chevron" />}</>; return href ? <Link className={`profile-row${danger ? ' danger-row' : ''}`} href={href}>{content}</Link> : <div className={`profile-row${danger ? ' danger-row' : ''}`}>{content}</div> }
export function ProfileNav() { const pathname = usePathname(); return <aside className="profile-nav"><p className="profile-nav-title">Profile</p>{profileSections.map(({ href, label, icon: Icon }) => <Link className={pathname === href ? 'selected' : ''} href={href} key={href}><Icon />{label}</Link>)}</aside> }
export function ProfileLayout({ children }: { children: React.ReactNode }) { return <div className="profile-layout"><ProfileNav /><section className="profile-panel">{children}</section></div> }

export function ProfileHub({ user, profile }: { user: PastQUser; profile: PastQProfile }) { const router = useRouter(); const name = profile.display_name || user.name || 'PastQ learner'; const [redirected, setRedirected] = useState(false); useEffect(() => { if (window.innerWidth >= 768 && !redirected) { setRedirected(true); router.replace('/profile/edit') } }, [redirected, router]); async function signOut() { await fetch('/api/auth/signout', { method: 'POST' }); window.location.href = '/' } return <div className="profile-hub"><PageHeader title="Profile" back={false} /><div className="profile-summary"><Avatar user={user} name={name} /><div><h2>{name}</h2><p>{user.email}</p><span className="status-chip">Free plan</span></div></div>{groups.map((group) => <section className="profile-group" key={group.title}><h2>{group.title}</h2><div className="profile-card">{group.items.map((item) => <ProfileRow key={item.href} {...item} />)}</div></section>)}<button className="profile-row standalone-action" onClick={signOut}><LogOut className="row-icon" /><span>Sign out</span></button><section className="profile-group danger-group"><h2>Danger zone</h2><div className="profile-card"><ProfileRow href="/profile/delete" icon={Trash2} label="Delete account" danger /></div></section></div> }

export function Toast({ message, error = false }: { message: string; error?: boolean }) { return message ? <p className={error ? 'toast error' : 'toast'} role="status">{message}</p> : null }
export function useProfileSave(initial: any) { const [values, setValues] = useState<any>(initial); const [message, setMessage] = useState(''); const [error, setError] = useState(false); const [saving, setSaving] = useState(false); const dirty = JSON.stringify(values) !== JSON.stringify(initial); async function save() { setSaving(true); setMessage(''); try { const response = await fetch('/api/profile', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || 'Could not save changes.'); setMessage('Changes saved.'); setError(false) } catch (err) { setMessage(err instanceof Error ? err.message : 'Could not save changes.'); setError(true) } finally { setSaving(false) } } return { values, setValues, dirty, save, saving, message, error } }
