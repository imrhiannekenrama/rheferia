import type { SearchFilters, SortOrder } from "@/lib/search/types";
import { RESOURCE_TYPE_LABELS } from "@/lib/search/types";

/**
 * Search filter form. Native GET form: submits to /search with URL params,
 * so filter state survives refresh, back navigation, and sharing.
 */
export function FilterForm({
  query,
  filters,
  sort,
}: {
  query: string;
  filters: SearchFilters;
  sort: SortOrder;
}) {
  const typeOptions = Object.entries(RESOURCE_TYPE_LABELS).filter(
    ([value]) => value !== "other" && value !== "webpage",
  );
  const selectedTypes = new Set(filters.resourceTypes ?? []);

  return (
    <form action="/search" className="space-y-4 rounded-lg border bg-card p-4">
      <input type="hidden" name="q" value={query} />
      {filters.exactPhrase && (
        <input type="hidden" name="exactPhrase" value={filters.exactPhrase} />
      )}
      {filters.author && <input type="hidden" name="author" value={filters.author} />}

      <div>
        <label htmlFor="sort" className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase">
          Sort
        </label>
        <select
          id="sort"
          name="sort"
          defaultValue={sort}
          className="h-8 w-full rounded-md border border-input bg-card px-2 text-sm"
        >
          <option value="relevance">Relevance</option>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="citations">Most cited</option>
        </select>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase">
          Publication years
        </legend>
        <div className="flex items-center gap-2">
          <input
            name="yearFrom"
            defaultValue={filters.yearFrom ?? ""}
            inputMode="numeric"
            placeholder="From"
            aria-label="Year from"
            className="h-8 w-full rounded-md border border-input bg-card px-2 text-sm"
          />
          <span className="text-muted-foreground">–</span>
          <input
            name="yearTo"
            defaultValue={filters.yearTo ?? ""}
            inputMode="numeric"
            placeholder="To"
            aria-label="Year to"
            className="h-8 w-full rounded-md border border-input bg-card px-2 text-sm"
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase">
          Resource type
        </legend>
        <div className="space-y-1">
          {typeOptions.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="types"
                value={value}
                defaultChecked={selectedTypes.has(value as never)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="openAccess"
          value="true"
          defaultChecked={filters.openAccessOnly}
          className="h-4 w-4 rounded border-input accent-primary"
        />
        Open-access full text only
      </label>

      <button
        type="submit"
        className="h-9 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Apply filters
      </button>
    </form>
  );
}
