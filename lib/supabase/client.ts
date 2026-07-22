import { createBrowserClient } from '@supabase/ssr';

// Used inside client components ('use client'). Reads the anon key,
// which is safe to expose — access is controlled by Row Level Security
// policies defined in supabase/schema.sql, not by hiding this key.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
