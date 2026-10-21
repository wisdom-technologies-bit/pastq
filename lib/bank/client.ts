import 'server-only'
import { env } from '@/lib/env'

export type BankError = { code: string; status: number; message: string }
export class BankRequestError extends Error implements BankError { code: string; status: number; constructor(error: BankError) { super(error.message); this.name = 'BankRequestError'; this.code = error.code; this.status = error.status } }

function errorFrom(status: number, body: unknown): BankRequestError {
  const item = body && typeof body === 'object' && 'error' in body ? (body as { error?: { code?: string; message?: string } }).error : undefined
  return new BankRequestError({ code: item?.code || (status >= 500 ? 'bank_unavailable' : 'request_failed'), status, message: item?.message || (status >= 500 ? "We couldn't load this right now" : 'The Bank request could not be completed') })
}
export async function bankFetch<T>(path: string, init: RequestInit = {}, options: { userId?: string; tier: 'free' | 'premium'; cache?: RequestCache; revalidate?: number; tags?: string[] } = { tier: 'free' }): Promise<T> {
  if (!env.BANK_API_URL || !env.BANK_SERVICE_KEY) throw new BankRequestError({ code: 'bank_unavailable', status: 503, message: "We couldn't load this right now" })
  const headers = new Headers(init.headers); headers.set('Authorization', `Bearer ${env.BANK_SERVICE_KEY}`); headers.set('Accept', 'application/json'); headers.set('X-Tier', options.tier); if (options.userId) headers.set('X-User-Ref', options.userId)
  let last: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8000)
    try {
      const response = await fetch(`${env.BANK_API_URL.replace(/\/$/, '')}/api/v1${path}`, { ...init, headers, signal: controller.signal, cache: options.cache ?? 'no-store', ...(options.revalidate ? { next: { revalidate: options.revalidate, tags: options.tags } } : {}) })
      clearTimeout(timeout); const body = await response.json().catch(() => null)
      if (response.ok) return body as T
      const error = errorFrom(response.status, body); if (response.status < 500) throw error; last = error
    } catch (error) { clearTimeout(timeout); if (error instanceof BankRequestError && error.status < 500) throw error; last = error }
  }
  throw last instanceof BankRequestError ? last : new BankRequestError({ code: 'bank_unavailable', status: 503, message: "We couldn't load this right now" })
}
