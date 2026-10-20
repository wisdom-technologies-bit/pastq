import { createClient, SupabaseClient } from '@supabase/supabase-js'
let client: SupabaseClient | undefined
export function getSupabaseAdmin() {
  if (!client) client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth:{autoRefreshToken:false,persistSession:false} })
  return client
}
