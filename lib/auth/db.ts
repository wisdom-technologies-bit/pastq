const url = process.env.SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function db<T = unknown>(table: string, init: RequestInit = {}, query = ''): Promise<T> {
  const response = await fetch(`${url}/rest/v1/${table}${query}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) }, cache: 'no-store' })
  if (!response.ok) throw new Error('Database request failed')
  const text = await response.text()
  return (text ? JSON.parse(text) : null) as T
}

export function rpc<T = unknown>(name: string, body: Record<string, unknown>) { return db<T>(`rpc/${name}`, { method: 'POST', body: JSON.stringify(body) }) }
