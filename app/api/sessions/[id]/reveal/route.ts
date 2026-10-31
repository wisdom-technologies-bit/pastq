import { NextResponse } from 'next/server'
import { assertSameOrigin } from '@/lib/auth/origin'
import { requireUser } from '@/lib/auth/session'
import { getTier } from '@/lib/entitlements'
import { getSession } from '@/lib/study-sessions'
import { bankFetch } from '@/lib/bank/client'
const hits = new Map<string, number[]>()
function out(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } }) }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { await assertSameOrigin(); const { user } = await requireUser(); const row = await getSession((await params).id, user.id); if (!row) return out({ error: 'Not found' }, 404); const now = Date.now(); const recent = (hits.get(user.id) || []).filter((t) => now - t < 60000); if (recent.length >= 60) return out({ error: 'Too many requests' }, 429); hits.set(user.id, [...recent, now]); const payload = await request.json().catch(() => ({})); const ref = String((payload as { ref?: unknown })?.ref || ''); if (!ref) return out({ error: 'Missing ref' }, 400); const result = await bankFetch(`/sessions/${row.bank_session_id}/reveal`, { method: 'POST', body: JSON.stringify({ ref }) }, { userId: user.id, tier: getTier(user) }); return out(result) }
