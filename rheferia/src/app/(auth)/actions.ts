"use server";

/**
 * Auth server actions: email/password sign-in, sign-up (requires email
 * confirmation when Supabase is configured), and sign-out.
 * All actions validate input server-side and degrade honestly when
 * Supabase is not configured.
 */

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(320);

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(200);

export interface AuthFormState {
  error?: string;
  notice?: string;
  ok?: boolean;
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = emailSchema.safeParse(formData.get("email"));
  const password = z.string().min(1, "Enter your password").safeParse(formData.get("password"));
  if (!email.success) return { error: email.error.issues[0]!.message };
  if (!password.success) return { error: password.error.issues[0]!.message };

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return {
      error:
        "Authentication is not configured yet. See docs/SUPABASE-SETUP.md to enable accounts.",
    };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: email.data,
    password: password.data as string,
  });
  if (error) {
    return { error: "Email or password is incorrect." };
  }

  const next = safeNext(formData);
  redirect(next);
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = emailSchema.safeParse(formData.get("email"));
  const password = passwordSchema.safeParse(formData.get("password"));
  const displayName = z.string().trim().max(80).optional().parse(formData.get("displayName") ?? undefined);
  if (!email.success) return { error: email.error.issues[0]!.message };
  if (!password.success) return { error: password.error.issues[0]!.message };

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return {
      error:
        "Authentication is not configured yet. See docs/SUPABASE-SETUP.md to enable accounts.",
    };
  }

  const { data, error } = await supabase.auth.signUp({
    email: email.data,
    password: password.data as string,
    options: {
      data: displayName ? { display_name: displayName } : undefined,
      emailRedirectTo: siteOrigin(await headers()) + "/auth/callback",
    },
  });

  if (error) {
    return {
      error:
        error.message.includes("already registered")
          ? "An account with this email already exists. Try signing in."
          : "Could not create the account. Please try again.",
    };
  }

  if (data.session) {
    redirect("/account");
  }

  return {
    ok: true,
    notice:
      "Check your email for the confirmation link we just sent. The link expires, so confirm soon.",
  };
}

export async function signOutAction() {
  const supabase = await getSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}

function siteOrigin(requestHeaders: Headers): string {
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

/** Only allow internal absolute paths for post-login redirects. */
function safeNext(formData: FormData): string {
  const raw = formData.get("next");
  if (typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return "/account";
}

