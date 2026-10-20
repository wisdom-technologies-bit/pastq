'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, ChartNoAxesColumnIncreasing, CircleUserRound, House, Menu, Moon, Monitor, Sun, Target, X } from 'lucide-react'
import { useEffect, useState } from 'react'

const navItems = [
  { href: '/', label: 'Home', icon: House },
  { href: '/practice', label: 'Practice', icon: BookOpen },
  { href: '/cbt', label: 'CBT', icon: Target },
  { href: '/progress', label: 'Progress', icon: ChartNoAxesColumnIncreasing },
  { href: '/profile', label: 'Profile', icon: CircleUserRound },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(true)
  const [dark, setDark] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    setDismissed(window.localStorage.getItem('pastq-install-dismissed') === '1')
    const saved = window.localStorage.getItem('pastq-theme')
    setDark(saved === 'dark')
    document.documentElement.classList.toggle('dark', saved === 'dark')
    const handler = (event: Event) => { event.preventDefault(); setInstallEvent(event as BeforeInstallPromptEvent) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function toggleTheme() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    window.localStorage.setItem('pastq-theme', next ? 'dark' : 'light')
  }

  function dismissInstall() {
    setDismissed(true)
    window.localStorage.setItem('pastq-install-dismissed', '1')
  }

  async function install() {
    if (!installEvent) return
    await installEvent.prompt()
    dismissInstall()
  }

  return <div className="app-frame">
    <aside className="sidebar" aria-label="Primary navigation">
      <Link className="brand-link" href="/" aria-label="PastQ home"><img src="/brand/pastq-wordmark.svg" alt="PastQ" /></Link>
      <nav className="desktop-nav">{navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname === href ? 'nav-link active' : 'nav-link'}><Icon size={20} strokeWidth={1.75} /><span>{label}</span></Link>)}</nav>
      <div className="sidebar-bottom"><button className="theme-switch" onClick={toggleTheme} aria-label="Toggle theme">{dark ? <Sun size={18} /> : <Moon size={18} />}<span>{dark ? 'Light mode' : 'Dark mode'}</span></button><div className="profile-slot"><span className="avatar">P</span><span><strong>PastQ learner</strong><small>Set up your profile</small></span><Menu size={17} /></div></div>
    </aside>
    <div className="main-column">
      <header className="topbar"><div className="mobile-brand"><Link href="/" aria-label="PastQ home"><img src="/brand/pastq-mark.svg" alt="" /></Link><span>{navItems.find((item) => item.href === pathname)?.label ?? 'PastQ'}</span></div><button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open menu" aria-expanded={menuOpen}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button></header>
      {menuOpen && <div className="mobile-menu">{navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMenuOpen(false)} className={pathname === href ? 'nav-link active' : 'nav-link'}><Icon size={20} /><span>{label}</span></Link>)}<button className="nav-link" onClick={toggleTheme}>{dark ? <Sun size={20} /> : <Moon size={20} />}<span>{dark ? 'Light mode' : 'Dark mode'}</span></button></div>}
      <main className="page-content">{children}</main>
    </div>
    <nav className="bottom-tabs" aria-label="Mobile navigation">{navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname === href ? 'tab active' : 'tab'}><Icon size={21} strokeWidth={1.75} /><span>{label}</span></Link>)}</nav>
    {!dismissed && <div className="install-card"><div><strong>Make PastQ yours</strong><p>Add it to your home screen for quick practice.</p></div><div className="install-actions">{installEvent && <button className="primary-button small" onClick={install}>Install</button>}<button className="text-button" onClick={dismissInstall}>Not now</button></div></div>}
  </div>
}

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> }
