/**
 * Supabase client + tiny helpers. The ONLY module that constructs the client.
 *
 * Auth/sync is *optional*: when the env vars are absent (local builds without a
 * .env, CI without secrets) `supabase` is null and every sync call no-ops, so
 * the app runs exactly as before on localStorage alone.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null

/** True when sign-in/sync is configured (env vars present). */
export const SUPABASE_ENABLED = supabase !== null

/**
 * Where a magic-link sign-in should land back — the app's own origin + Vite base
 * ("/" in dev, "/music-theory/" in prod). Both are in the Supabase redirect
 * allow-list.
 */
export function authRedirectTo(): string {
  return window.location.origin + import.meta.env.BASE_URL
}
