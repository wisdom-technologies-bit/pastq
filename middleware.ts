import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
export function middleware(request: NextRequest) { const protectedPath = ['/progress','/profile','/history','/focus','/cbt/start','/welcome'].some(path=>request.nextUrl.pathname.startsWith(path)); if (!protectedPath) return NextResponse.next(); const token=request.cookies.get('__Host-pastq_session')?.value; if(token)return NextResponse.next(); const url=new URL('/sign-in',request.url);url.searchParams.set('next',request.nextUrl.pathname);return NextResponse.redirect(url) }
export const config={matcher:['/progress/:path*','/profile/:path*','/history/:path*','/focus/:path*','/cbt/start/:path*']}
