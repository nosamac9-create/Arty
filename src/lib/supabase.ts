/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The single Supabase client for the app.
 *
 * Stage 1b: Supabase Auth owns credentials. Application data (workshops,
 * bookings, queue, pieces, …) is still served by Dexie and moves in Stage 2.
 *
 * Only the anon key is ever used here. The service_role key must never appear
 * in frontend code — it bypasses Row Level Security.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * True when the project has been configured. Until then the app keeps running
 * on Dexie and sign-in reports a clear configuration error rather than
 * throwing at import time.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        // Supabase persists and refreshes the session itself; the app no
        // longer keeps its own copy of the login state.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

export const SUPABASE_NOT_CONFIGURED =
  'Sign-in is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';

/** The signed-in auth user id, or null. */
export async function getAuthUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}
