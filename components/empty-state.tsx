import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

export function EmptyState({ icon: Icon, eyebrow, title, description, action, actionHref }: { icon: LucideIcon; eyebrow: string; title: string; description: string; action?: string; actionHref?: string }) {
  return <section className="empty-state"><div className="empty-icon"><Icon size={26} strokeWidth={1.75} /></div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p className="empty-description">{description}</p>{actionHref ? <Link className="primary-button" href={actionHref}>{action ?? 'Continue'}</Link> : action ? <button className="primary-button" type="button">{action}</button> : null}</section>
}
