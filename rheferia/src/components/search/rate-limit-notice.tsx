/**
 * Honest blocked-state screen for guests who hit the limit. Shows what
 * the limit is and how to proceed; never a generic "error".
 */

import Link from "next/link";

export function RateLimitNotice(props: {
  daily: boolean;
  retryAfterSeconds: number;
  used?: number;
  limit?: number;
}) {
  const minutes = Math.max(1, Math.ceil(props.retryAfterSeconds / 60));
  return (
    <div className="mx-auto max-w-xl rounded-lg border bg-card p-6 text-center">
      <h2 className="font-semibold">
        {props.daily ? "Daily guest limit reached" : "Search limit reached"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {props.daily
          ? `Guest searches are capped at ${props.limit} per day to keep the service available to everyone. Your counter resets at midnight UTC.`
          : `Too many searches in a short window. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`}
      </p>
      <div className="mt-5 flex justify-center gap-3">
        <Link
          href="/signup"
          className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Create a free account
        </Link>
        <Link
          href="/how-it-works"
          className="rounded-md border border-input bg-card px-5 py-2 text-sm font-medium hover:bg-secondary"
        >
          Why limits?
        </Link>
      </div>
    </div>
  );
}
