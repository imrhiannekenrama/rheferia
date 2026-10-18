"use client";

/**
 * Browser-side Supabase client (client components only). Auth flows use
 * server actions + middleware instead of client-side session handling,
 * so this is only for lightweight reads (e.g. optimistic UI).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return cached;
}
