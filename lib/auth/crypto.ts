import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'

export function normalizeEmail(email: string) { return email.trim().toLowerCase() }
export function generateCode() { return String(randomInt(0, 1_000_000)).padStart(6, '0') }
export function hashCode(code: string) { return createHmac('sha256', process.env.AUTH_SECRET!).update(code).digest('hex') }
export function safeEqual(a: string, b: string) { const left = Buffer.from(a); const right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right) }
export function safeNext(value: string | null | undefined) { return value?.startsWith('/') && !value.startsWith('//') ? value : '/app' }
