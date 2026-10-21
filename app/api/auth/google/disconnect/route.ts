import { NextResponse } from 'next/server'
import { db } from '@/lib/auth/db'
import { getCurrentUser } from '@/lib/auth/session'

export async function GET(request: Request) {
  const current = await getCurrentUser()
  if (!current) return NextResponse.redirect(new URL('/sign-in', request.url))
  await db('users', { method: 'PATCH', body: JSON.stringify({ google_sub: null }) }, `?id=eq.${current.user.id}`)
  return NextResponse.redirect(new URL('/profile/security', request.url))
}
