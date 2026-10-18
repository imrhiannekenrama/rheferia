import { Skeleton } from "@/components/ui/skeleton";

export default function SearchLoading() {
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-8 sm:px-6" aria-busy="true" aria-label="Loading search results">
      <Skeleton className="h-12 w-full rounded-lg" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
        <Skeleton className="h-72 rounded-lg" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      </div>
    </main>
  );
}
