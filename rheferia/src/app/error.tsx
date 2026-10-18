"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main-content" className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center px-4 text-center">
      <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
        Something went wrong
      </p>
      <h1 className="mt-2 font-serif text-3xl font-semibold">An unexpected error occurred</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your data is safe. Try again, or return to the homepage.
        {error.digest ? ` Reference: ${error.digest}` : ""}
      </p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-input bg-card px-5 py-2.5 text-sm font-medium hover:bg-secondary"
        >
          Homepage
        </Link>
      </div>
    </main>
  );
}
