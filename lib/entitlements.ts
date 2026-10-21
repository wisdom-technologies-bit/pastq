import type { PastQUser } from './auth/session'
export function getTier(_user?: PastQUser): 'free' | 'premium' { return 'free' }
