import type { ProviderStatus } from "@/lib/search/types";
import { Badge } from "@/components/ui/badge";

const PROVIDER_LABELS: Record<string, string> = {
  openalex: "OpenAlex",
  crossref: "Crossref",
  unpaywall: "Unpaywall",
  "semantic-scholar": "Semantic Scholar",
  brave: "Brave web search",
};

const STATE_LABELS: Record<string, { label: string; variant: "success" | "secondary" | "outline" | "warning" }> = {
  ok: { label: "Responded", variant: "success" },
  "not-configured": { label: "Not configured", variant: "outline" },
  "no-matches": { label: "No matches", variant: "outline" },
  "rate-limited": { label: "Rate limited", variant: "warning" },
  "timed-out": { label: "Timed out", variant: "warning" },
  error: { label: "Unavailable", variant: "warning" },
  skipped: { label: "Skipped", variant: "outline" },
};

export function ProviderStatusPanel({ statuses }: { statuses: ProviderStatus[] }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">Sources for this search</h2>
      <ul className="mt-2 space-y-1.5">
        {statuses.map((status) => {
          const state = STATE_LABELS[status.state] ?? STATE_LABELS.error!;
          return (
            <li key={status.provider} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium">{PROVIDER_LABELS[status.provider] ?? status.provider}</span>
              <Badge variant={state.variant}>{state.label}</Badge>
              {status.resultCount != null && status.resultCount > 0 && (
                <span className="text-muted-foreground">{status.resultCount} results</span>
              )}
              {status.message && (
                <span className="text-muted-foreground">{status.message}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
