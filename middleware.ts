import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
const protectedPaths=['/progress','/profile','/history','/practice','/cbt']
export function middleware(request: NextRequest) { if(protectedPaths.some(path=>request.nextUrl.pathname.startsWith(path))) { const hasSession=request.cookies.has('__Host-pastq_session'); if(!hasSession) { const url=new URL('/sign-in',request.url); url.searchParams.set('next',request.nextUrl.pathname); return NextResponse.redirect(url) } } return NextResponse.next() }
export const config={matcher:['/progress/:path*','/profile/:path*','/history/:path*','/practice/:path*','/cbt/:path*']}
