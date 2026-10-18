import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { brand } from "@/lib/config/brand";
import { isSupabaseConfigured } from "@/lib/config/env";

export function SiteHeader() {
  const authReady = isSupabaseConfigured();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-ring"
        >
          <BrandMark className="h-7 w-7" />
          <span className="text-[17px] font-semibold tracking-tight">
            {brand.name}
          </span>
        </Link>
        <nav
          className="flex items-center gap-5 text-sm"
          aria-label="Primary"
        >
          <Link
            href="/search"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Search
          </Link>
          <Link
            href="/citations"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Citations
          </Link>
          <Link
            href="/tools"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Tools
          </Link>
          <Link
            href="/how-it-works"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            How it works
          </Link>
          {authReady ? (
            <Link
              href="/login"
              className="rounded-md bg-primary px-3.5 py-1.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Sign in
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-md border border-input bg-card px-3.5 py-1.5 font-medium transition-colors hover:bg-secondary"
              title="Sign-in requires Supabase configuration"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
