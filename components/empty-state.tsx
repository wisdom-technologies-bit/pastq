import type { LucideIcon } from 'lucide-react'

export function EmptyState({ icon: Icon, eyebrow, title, description, action }: { icon: LucideIcon; eyebrow: string; title: string; description: string; action?: string }) {
  return <section className="empty-state"><div className="empty-icon"><Icon size={26} strokeWidth={1.75} /></div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p className="empty-description">{description}</p>{action && <button className="primary-button" type="button">{action}</button>}</section>
}
