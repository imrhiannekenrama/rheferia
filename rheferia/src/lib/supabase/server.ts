/**
 * Server-side Supabase access.
 *
 * Three clients, three jobs:
 *  - `getSupabaseServerClient()` — cookie-bound user client for SSR pages
 *    and server actions (uses @supabase/ssr so auth state survives RSC).
 *  - `getServiceSupabase()` — service-role client for durable guest limits
 *    and operations the user must not be able to forge. Server-only env.
 *  - `isSupabaseConfigured()` — gates every auth-dependent path.
 *
 * When Supabase is NOT configured, every function degrades honestly
 * (returns null clients; callers show "not configured" states) instead of
 * crashing the build or pretending accounts work.
 */

import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function url(): string | undefined {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return value && value.trim() ? value.trim() : undefined;
}

function anonKey(): string | undefined {
  const value = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return value && value.trim() ? value.trim() : undefined;
}

function serviceKey(): string | undefined {
  // Server-only; never exposed to the browser bundle under NEXT_PUBLIC_.
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return value && value.trim() ? value.trim() : undefined;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(url() && anonKey());
}

/** User-scoped client bound to request cookies; null when unconfigured. */
export async function getSupabaseServerClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;
  const cookieStore = await cookies();
  return createServerClient(url()!, anonKey()!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // setAll can throw in a Server Component render context; the
          // middleware refresh flow covers session cookies there.
        }
      },
    },
  });
}

/** Service-role client; null when unconfigured. Never return this to client code. */
export function getServiceSupabase(): SupabaseClient | null {
  if (!url() || !serviceKey()) return null;
  return createClient(url()!, serviceKey()!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** The signed-in user for the current request, or null (guest). */
export async function getCurrentUser() {
  const client = await getSupabaseServerClient();
  if (!client) return null;
  const {
    data: { user },
  } = await client.auth.getUser();
  return user;
}
