import type { Metadata } from "next";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/config/env";
import { AuthForm } from "@/components/auth/auth-form";
import { signUpAction } from "@/app/(auth)/actions";

export const metadata: Metadata = { title: "Create an account" };

export default function SignupPage() {
  const configured = isSupabaseConfigured();

  return (
    <main id="main-content" className="mx-auto flex min-h-[70dvh] max-w-md flex-col justify-center px-4 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">
        Create an account
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Free accounts unlock projects, saved sources, reference lists, and
        citation exports.
      </p>

      {configured ? (
        <>
          <AuthForm
            action={signUpAction}
            submitLabel="Create account"
            showDisplayName
            showPasswordHint
          />
          <p className="mt-4 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </>
      ) : (
        <div className="mt-4 rounded-lg border bg-card p-4">
          <p className="text-sm font-medium">Authentication is not configured yet.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Follow{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">docs/SUPABASE-SETUP.md</code>{" "}
            to enable accounts first. Search works without one.
          </p>
        </div>
      )}
    </main>
  );
}
