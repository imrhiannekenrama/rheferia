"use client";

/**
 * Shared auth form (sign-in and sign-up). useActionState drives pending
 * states and inline errors; no client-side session handling.
 */

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { AuthFormState } from "@/app/(auth)/actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-10 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Working…" : label}
    </button>
  );
}

export function AuthForm({
  action,
  submitLabel,
  showDisplayName,
  notice,
  showPasswordHint,
}: {
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  submitLabel: string;
  showDisplayName?: boolean;
  notice?: string;
  showPasswordHint?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {showDisplayName && (
        <div>
          <label htmlFor="displayName" className="mb-1.5 block text-sm font-medium">
            Display name <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            autoComplete="nickname"
            maxLength={80}
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      )}

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={showDisplayName ? "new-password" : "current-password"}
          className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {showPasswordHint && (
          <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
        )}
      </div>

      {state.error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p role="status" className="rounded-md border bg-card px-3 py-2 text-sm">
          {state.notice}
        </p>
      )}
      {notice && !state.error && !state.notice && (
        <p className="text-sm text-muted-foreground">{notice}</p>
      )}

      <SubmitButton label={submitLabel} />
    </form>
  );
}
