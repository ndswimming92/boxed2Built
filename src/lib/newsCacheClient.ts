import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * A read-only client for the public /news page that goes through the cached
 * route in netlify/functions/news-cache.ts instead of straight to Supabase.
 *
 * It has no session on purpose: whatever it returns is cached and shared, so it
 * must only ever be the anonymous view. Created on first use, in the browser
 * only; during the build there is nobody to cache for.
 */
let client: SupabaseClient | null = null;

export function getNewsCacheClient(): SupabaseClient | null {
  if (typeof window === 'undefined') return null;
  if (!client) {
    client = createClient(
      `${window.location.origin}/api/news-cache`,
      import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: 'boxed2built.news-cache.auth',
        },
      },
    );
  }
  return client;
}
