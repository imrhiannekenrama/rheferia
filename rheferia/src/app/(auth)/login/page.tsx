import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/config/env";
import { getCurrentUser } from "@/lib/supabase/server";
import { AuthForm } from "@/components/auth/auth-form";
import { signInAction } from "@/app/(auth)/actions";

export const metadata: Metadata = { title: "Sign in" };

interface LoginPageProps {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, error } = await searchParams;
  const configured = isSupabaseConfigured();

  if (configured) {
    const user = await getCurrentUser();
    if (user) redirect(next && next.startsWith("/") ? next : "/account");
  }

  return (
    <main id="main-content" className="mx-auto flex min-h-[70dvh] max-w-md flex-col justify-center px-4 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sign in to save sources into projects, build reference lists, and
        export citations.
      </p>

      {configured ? (
        <>
          {error === "confirmation" && (
            <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              That confirmation link didn&apos;t work. Links expire — request a new one or try signing in.
            </p>
          )}
          <AuthForm action={signInAction} submitLabel="Sign in" />
          <p className="mt-4 text-sm text-muted-foreground">
            New here?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </p>
        </>
      ) : (
        <div className="mt-4 rounded-lg border bg-card p-4">
          <p className="text-sm font-medium">Authentication is not configured yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Rheferia uses Supabase for accounts, private projects, and saved
            research. Follow{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">docs/SUPABASE-SETUP.md</code>{" "}
            and add your project URL and publishable key to{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code>.
            You can still search and browse sources without an account.
          </p>
        </div>
      )}
    </main>
  );
}
