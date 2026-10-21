'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, ChartNoAxesColumnIncreasing, CircleUserRound, House, Moon, Sun, Target } from 'lucide-react'
import { useEffect, useState } from 'react'

const navItems = [{ href: '/app', label: 'Home', icon: House }, { href: '/practice', label: 'Practice', icon: BookOpen }, { href: '/cbt', label: 'CBT', icon: Target }, { href: '/progress', label: 'Progress', icon: ChartNoAxesColumnIncreasing }, { href: '/profile', label: 'Profile', icon: CircleUserRound }]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(true)
  const [dark, setDark] = useState(false)
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    setDismissed(window.localStorage.getItem('pastq-install-dismissed') === '1')
    const saved = document.cookie.match(/pastq_theme=([^;]+)/)?.[1] || 'system'
    const isDark = saved === 'dark' || (saved === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    setDark(isDark); document.documentElement.classList.toggle('dark', isDark)
    const handler = (event: Event) => { event.preventDefault(); setInstallEvent(event as BeforeInstallPromptEvent) }
    window.addEventListener('beforeinstallprompt', handler); return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])
  function toggleTheme() { const next = !dark; setDark(next); document.documentElement.classList.toggle('dark', next); window.localStorage.setItem('pastq-theme', next ? 'dark' : 'light') }
  function dismissInstall() { setDismissed(true); window.localStorage.setItem('pastq-install-dismissed', '1') }
  async function install() { if (!installEvent) return; await installEvent.prompt(); dismissInstall() }
  const title = navItems.find((item) => item.href === pathname)?.label ?? 'PastQ'
  return <div className="app-frame"><aside className="sidebar" aria-label="Primary navigation"><Link className="brand-link" href="/" aria-label="PastQ home"><img src="/brand/pastq-wordmark.svg" alt="PastQ" /></Link><nav className="desktop-nav">{navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname === href ? 'nav-link active' : 'nav-link'}><Icon size={20} strokeWidth={1.75}/><span>{label}</span></Link>)}</nav><div className="sidebar-bottom"><button className="theme-switch" onClick={toggleTheme} aria-label="Toggle theme">{dark ? <Sun size={18}/> : <Moon size={18}/>}<span>{dark ? 'Light mode' : 'Dark mode'}</span></button><div className="profile-slot"><span className="avatar">P</span><span><strong>PastQ learner</strong><small>Set up your profile</small></span></div></div></aside><div className="main-column"><header className="topbar"><div className="mobile-brand"><Link href="/" aria-label="PastQ home"><img src="/brand/pastq-mark.svg" alt="" /></Link><span>{title}</span></div></header><main className="page-content">{children}</main></div><nav className="bottom-tabs" aria-label="Mobile navigation">{navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname === href ? 'tab active' : 'tab'}><Icon size={21} strokeWidth={1.75}/><span>{label}</span></Link>)}</nav>{!dismissed && <div className="install-card"><div><strong>Make PastQ yours</strong><p>Add it to your home screen for quick practice.</p></div><div className="install-actions">{installEvent && <button className="primary-button small" onClick={install}>Install</button>}<button className="text-button" onClick={dismissInstall}>Not now</button></div></div>} </div>
}
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> }
