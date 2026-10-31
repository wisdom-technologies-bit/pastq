import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { getTier } from '@/lib/entitlements'
import { getSession } from '@/lib/study-sessions'
import { bankFetch } from '@/lib/bank/client'

const allowed = /<\/?(?:p|br|b|strong|i|em|u|sub|sup|span|ul|ol|li|table|thead|tbody|tr|th|td)(?:\s[^>]*)?>/gi
function clean(value: unknown): unknown {
  if (typeof value !== 'string') return value
  return value.replace(/<(?!\/?(?:p|br|b|strong|i|em|u|sub|sup|span|ul|ol|li|table|thead|tbody|tr|th|td)\b)[^>]*>/gi, '').replace(allowed, (tag) => tag.replace(/\s(?:on\w+|style|class|href|src)=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, (attr) => /src=/i.test(attr) && /^\s*src=["']https:\/\//i.test(attr) ? attr : ''))
  return value
}
function sanitize(item: any): any { if (typeof item === 'string') return clean(item); if (!item || typeof item !== 'object') return item; if (Array.isArray(item)) return item.map(sanitize); const out: any = {}; for (const [key, value] of Object.entries(item)) out[key] = /^(image_url|imageUrl)$/i.test(key) ? (typeof value === 'string' && value.startsWith('https://') ? value : null) : sanitize(value); return out }
function response(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } }) }
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) { const { user } = await requireUser(); const row = await getSession((await params).id, user.id); if (!row) return response({ error: 'Not found' }, 404); const url = new URL(request.url); const from = Math.max(1, Number(url.searchParams.get('from') || 1)); const limit = Math.min(60, Math.max(1, Number(url.searchParams.get('limit') || 30))); const body = await bankFetch<any>(`/sessions/${row.bank_session_id}/questions?from=${from}&limit=${limit}`, {}, { userId: user.id, tier: getTier(user) }); const safe = sanitize(body) as any; return response({ ...safe, meta: { ...(safe.meta ?? {}), total: row.total_questions, total_questions: row.total_questions } }) }
