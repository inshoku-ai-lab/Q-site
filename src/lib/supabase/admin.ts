import { createClient } from "@supabase/supabase-js";

// Service-role client for privileged server-only operations (deleting Auth
// users, reading tables with no RLS policy for the authenticated role).
// Never import this from client-side code.
export function createSupabaseAdminClient() {
  return createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
