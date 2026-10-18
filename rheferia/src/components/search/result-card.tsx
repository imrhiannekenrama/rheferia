import Link from "next/link";
import type { ResourceRecord } from "@/lib/search/types";
import {
  ACCESS_STATUS_LABELS,
  RESOURCE_TYPE_LABELS,
} from "@/lib/search/types";
import { Badge } from "@/components/ui/badge";
import { formatAuthors } from "@/lib/search/normalization";

const ACCESS_BADGE_VARIANT: Record<string, "success" | "warning" | "secondary" | "outline"> = {
  "open-access": "success",
  "link-reported": "warning",
  "source-access-required": "secondary",
  "metadata-only": "outline",
  unknown: "outline",
};

const MATCH_LABELS: Record<string, string> = {
  "exact-match": "Exact match",
  "strong-topic-match": "Strong topic match",
  "topical-match": "Topical match",
  related: "Related",
};

export function ResultCard({ record }: { record: ResourceRecord }) {
  const bestAccess = record.locations[0]?.accessStatus ?? "metadata-only";
  const openAccess = record.locations.find((l) => l.accessStatus === "open-access");
  const sourceLink = openAccess?.url ?? record.locations[0]?.url;
  const sourceLabel = openAccess ? "Open full text" : "Open source";
  const truncatedTitle = record.title.length > 220;

  return (
    <article className="rounded-lg border bg-card p-5 transition-shadow hover:shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{RESOURCE_TYPE_LABELS[record.resourceType]}</Badge>
        {record.year != null && <span>{record.year}</span>}
        {record.match && record.match.label !== "related" && (
          <Badge variant="default">{MATCH_LABELS[record.match.label]}</Badge>
        )}
        {record.isRetracted === true && (
          <Badge variant="warning">Retraction recorded</Badge>
        )}
      </div>

      <h3 className="mt-2 leading-snug font-semibold">
        <Link
          href={`/sources/${encodeURIComponent(record.id)}`}
          className="hover:text-primary hover:underline"
        >
          {truncatedTitle ? `${record.title.slice(0, 220)}…` : record.title}
        </Link>
      </h3>

      <p className="mt-1 text-sm text-muted-foreground">
        {formatAuthors(record.authors)}
        {record.venue ? ` — ${record.venue}` : ""}
      </p>

      {record.abstract && (
        <p className="reading-measure mt-2 text-sm text-muted-foreground">
          {record.abstract.length > 300
            ? `${record.abstract.slice(0, 300)}…`
            : record.abstract}
        </p>
      )}

      {record.match && record.match.matchedTerms.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Matched terms: {record.match.matchedTerms.join(", ")}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Badge variant={ACCESS_BADGE_VARIANT[bestAccess] ?? "outline"}>
          {ACCESS_STATUS_LABELS[bestAccess]}
        </Badge>
        {record.doi && (
          <span className="font-mono text-xs text-muted-foreground">
            DOI: {record.doi}
          </span>
        )}
        {record.citationCount != null && record.citationCount > 0 && (
          <span className="text-xs text-muted-foreground">
            Cited by {record.citationCount}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {sourceLink && (
          <a
            href={sourceLink}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {sourceLabel}
          </a>
        )}
        <Link
          href={`/sources/${encodeURIComponent(record.id)}`}
          className="rounded-md border border-input bg-card px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-secondary"
        >
          Details & citation
        </Link>
        <span
          className="rounded-md border border-dashed border-input px-3.5 py-1.5 text-sm text-muted-foreground"
          title="Saving needs an account. Authentication arrives with the Supabase setup phase."
        >
          Save (needs account)
        </span>
      </div>
    </article>
  );
}
