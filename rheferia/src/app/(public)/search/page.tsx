import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { executeSearch } from "@/lib/search/execute";
import { checkSearchRateLimit, clientIpFrom } from "@/lib/security/rate-limit";
import { getCurrentUser } from "@/lib/supabase/server";
import { RateLimitNotice } from "@/components/search/rate-limit-notice";
import {
  searchRequestSchema,
  toSearchRequest,
} from "@/lib/validation/search";
import { ResultCard } from "@/components/search/result-card";
import { ProviderStatusPanel } from "@/components/search/provider-status";
import { FilterForm } from "@/components/search/filter-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search",
  description: "Find relevant research and available full texts.",
};

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const raw = await searchParams;
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") flat[key] = value;
    else if (Array.isArray(value) && value[0]) flat[key] = value.join(",");
  }

  const parsed = searchRequestSchema.safeParse(flat);

  if (!parsed.success) {
    return (
      <main id="main-content" className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <h1 className="font-serif text-3xl font-semibold">Search Rheferia</h1>
        <p className="mt-3 text-muted-foreground">
          {flat.q
            ? parsed.error.issues[0]?.message ?? "That search could not be run."
            : "Enter a study title, research question, DOI, or keywords to begin."}
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Back to the search field
        </Link>
      </main>
    );
  }

  const request = toSearchRequest(parsed.data);

  // Guest limits: signed-in accounts are not guest-limited.
  const user = await getCurrentUser();
  let limit = null;
  if (!user) {
    limit = await checkSearchRateLimit(clientIpFrom(await headers()));
    if (!limit.allowed) {
      return (
        <main id="main-content" className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <RateLimitNotice
            daily={Boolean(limit.dailyLimit)}
            retryAfterSeconds={limit.retryAfterSeconds}
            used={limit.dailyLimit?.used}
            limit={limit.dailyLimit?.limit}
          />
        </main>
      );
    }
  }

  const response = await executeSearch(request);

  const queryState = new URLSearchParams();
  queryState.set("q", request.query);
  for (const [key, value] of Object.entries(flat)) {
    if (key !== "q" && key !== "cursor" && value) queryState.set(key, value);
  }
  const loadMoreHref = response.nextCursor
    ? `/search?${queryState.toString()}&cursor=${encodeURIComponent(response.nextCursor)}`
    : null;

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Search header */}
      <div className="flex flex-col gap-3">
        <form action="/search" className="flex items-center gap-2 rounded-lg border bg-card p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-ring">
          <label htmlFor="search-input" className="sr-only">
            Search query
          </label>
          <input
            id="search-input"
            name="q"
            type="search"
            defaultValue={request.query}
            className="h-10 min-w-0 flex-1 rounded-md bg-transparent px-3 text-[15px] outline-none placeholder:text-muted-foreground/70"
          />
          <button
            type="submit"
            className="h-10 shrink-0 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Search
          </button>
        </form>

        {response.queryPlan && response.queryPlan.keywords.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Searched as: {response.queryPlan.queries.join(" · ")}
            {response.queryPlan.broadened && " (broadened to related concepts)"}
          </p>
        )}
        {response.coverageNote && (
          <p className="text-xs text-muted-foreground">{response.coverageNote}</p>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Filters */}
        <aside aria-label="Filters">
          <FilterForm
            query={request.query}
            filters={request.filters}
            sort={request.sort}
          />
        </aside>

        {/* Results column */}
        <div className="min-w-0">
          {response.results.length === 0 ? (
            <div className="rounded-lg border bg-card p-8 text-center">
              <h2 className="font-semibold">No matching sources</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Try broader terms, fewer filters, or a different phrasing.
                You can also paste a DOI to resolve it directly.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {response.results.map((record) => (
                  <ResultCard key={record.id} record={record} />
                ))}
              </div>
              {loadMoreHref && (
                <div className="mt-6 text-center">
                  <Link
                    href={loadMoreHref}
                    className="inline-block rounded-md border border-input bg-card px-6 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
                  >
                    Load more results
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-8 max-w-xl">
        <ProviderStatusPanel statuses={response.providerStatuses} />
      </div>
    </main>
  );
}
