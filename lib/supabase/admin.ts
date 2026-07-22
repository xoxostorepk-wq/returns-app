import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// SERVER-ONLY. Never import this file from a client component — the service
// role key bypasses Row Level Security entirely. It must only be read from
// process.env on the server (route handlers / server actions) and must
// never be prefixed with NEXT_PUBLIC_.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
