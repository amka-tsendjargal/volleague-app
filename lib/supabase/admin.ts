import { createClient } from '@supabase/supabase-js'

// Service-role client for trusted server-side code only. Bypasses RLS, so
// it exists to stand in for a real authenticated session until login is
// built (see SEED_CAPTAIN_ID) — never import this from client components.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
