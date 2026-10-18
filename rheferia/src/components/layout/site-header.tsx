import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { brand } from "@/lib/config/brand";
import { isSupabaseConfigured } from "@/lib/config/env";

const NAV = [
  { href: "/search", label: "Search" },
  { href: "/citations", label: "Citations" },
  { href: "/tools", label: "Tools" },
  { href: "/how-it-works", label: "How it works" },
];

export function SiteHeader() {
  const authReady = isSupabaseConfigured();

  const signIn = (
    <Link
      href="/login"
      className={
        authReady
          ? "rounded-md bg-primary px-3.5 py-1.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          : "rounded-md border border-input bg-card px-3.5 py-1.5 font-medium transition-colors hover:bg-secondary"
      }
      title={authReady ? undefined : "Sign-in requires Supabase configuration"}
    >
      Sign in
    </Link>
  );

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

        {/* Desktop navigation */}
        <nav className="hidden items-center gap-5 text-sm sm:flex" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          {signIn}
        </nav>

        {/* Mobile menu */}
        <details className="group relative sm:hidden">
          <summary
            className="flex h-9 w-9 list-none items-center justify-center rounded-md border border-input bg-card text-foreground transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden"
            aria-label="Open menu"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="h-4.5 w-4.5"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </summary>
          <nav
            className="absolute right-0 top-11 z-50 w-48 rounded-lg border bg-popover p-2 shadow-lg"
            aria-label="Primary mobile"
          >
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-3 py-2 text-sm text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 border-t pt-2">{signIn}</div>
          </nav>
        </details>
      </div>
    </header>
  );
}