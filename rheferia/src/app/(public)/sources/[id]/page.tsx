import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveResource } from "@/lib/search/resolve";
import { searchProviderConfig } from "@/lib/config/env";
import {
  getReferencedWorkIds,
  getWorksByIds,
} from "@/lib/search/providers/openalex";
import {
  ACCESS_STATUS_LABELS,
  RESOURCE_TYPE_LABELS,
  type ResourceRecord,
} from "@/lib/search/types";
import { formatAuthors } from "@/lib/search/normalization";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const record = await resolveResource(id);
  return {
    title: record ? record.title.slice(0, 120) : "Source not found",
    description: record?.abstract?.slice(0, 180) ?? undefined,
  };
}

/** Simple, honest APA 7 preview (full CSL engine arrives with Rheferia Cite). */
function apaPreview(record: ResourceRecord): string {
  const authors = record.authors.length
    ? record.authors.map((a) => a.raw).join(", ")
    : "Unknown author";
  const year = record.year != null ? `(${record.year})` : "(n.d.)";
  const venue = record.venue ? `*${record.venue}*. ` : "";
  const doi = record.doi ? ` https://doi.org/${record.doi}` : "";
  return `${authors} ${year}. ${record.title}. ${venue}${doi}`.replace(/\s+/g, " ").trim();
}

export default async function SourceDetailPage({ params }: PageProps) {
  const { id } = await params;
  const record = await resolveResource(id);
  if (!record) notFound();

  // References cited by this paper (bounded, provider-supplied only).
  const config = searchProviderConfig();
  let references: Array<Pick<ResourceRecord, "id" | "title" | "year" | "doi">> = [];
  let referencesNote = "Reference data is unavailable for this record.";
  if (record.providers.includes("openalex")) {
    try {
      const nativeId = record.identifiers.find((i) => i.provider === "openalex")?.id;
      if (nativeId) {
        const ids = await getReferencedWorkIds(
          { apiKey: config.openalexApiKey, contactEmail: config.crossrefContactEmail },
          nativeId,
          25,
        );
        references = await getWorksByIds(
          { apiKey: config.openalexApiKey, contactEmail: config.crossrefContactEmail },
          ids,
        );
        referencesNote =
          ids.length === 0
            ? "This record lists no references in OpenAlex."
            : references.length === 0
              ? "Reference ids could not be resolved to titles right now."
              : `First ${references.length} references as supplied by OpenAlex (incomplete by design; see the original paper for the full bibliography).`;
      }
    } catch {
      referencesNote = "Reference data could not be loaded right now.";
    }
  }

  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/search" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to search
      </Link>

      <article className="mt-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{RESOURCE_TYPE_LABELS[record.resourceType]}</Badge>
          {record.year != null && <span>{record.year}</span>}
          {record.isRetracted === true && (
            <Badge variant="warning">Retraction recorded</Badge>
          )}
        </div>

        <h1 className="mt-3 font-serif text-2xl leading-snug font-semibold tracking-tight sm:text-3xl">
          {record.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {formatAuthors(record.authors)}
        </p>
        {(record.venue || record.publisher) && (
          <p className="mt-1 text-sm text-muted-foreground">
            {[record.venue, record.publisher].filter(Boolean).join(" — ")}
          </p>
        )}
        {record.doi && (
          <p className="mt-1 font-mono text-xs text-muted-foreground">DOI: {record.doi}</p>
        )}
        {record.citationCount != null && (
          <p className="mt-1 text-xs text-muted-foreground">
            Cited by {record.citationCount} ({record.providers.includes("openalex") ? "per OpenAlex" : "per provider metadata"})
          </p>
        )}

        {/* Abstract */}
        {record.abstract && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold">Abstract</h2>
            <p className="reading-measure mt-2 text-[15px] text-muted-foreground">
              {record.abstract}
            </p>
          </section>
        )}

        {/* Access locations */}
        <section className="mt-6">
          <h2 className="text-sm font-semibold">Access</h2>
          {record.locations.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {ACCESS_STATUS_LABELS["metadata-only"]}: no suitable full-text link is known.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {record.locations.map((loc) => (
                <li
                  key={loc.url}
                  className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-3 text-sm"
                >
                  <Badge variant={loc.accessStatus === "open-access" ? "success" : "secondary"}>
                    {ACCESS_STATUS_LABELS[loc.accessStatus]}
                  </Badge>
                  <a
                    href={loc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    {loc.label}
                  </a>
                  {loc.license && (
                    <span className="text-xs text-muted-foreground">License: {loc.license}</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    via {loc.source}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            A link is not a guarantee of unrestricted access. Rheferia never bypasses
            publisher access controls.
          </p>
        </section>

        {/* Citation preview */}
        <section className="mt-6">
          <h2 className="text-sm font-semibold">Citation preview (APA 7)</h2>
          <p className="reading-measure mt-2 rounded-md border bg-card p-3 text-sm">
            {apaPreview(record)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Review this citation before use. The full citation engine with more styles
            and exports is part of {`Rheferia Cite`}.
          </p>
        </section>

        {/* References cited by this paper (distinct from the user's list) */}
        <section className="mt-6">
          <details>
            <summary className="cursor-pointer text-sm font-semibold">
              References cited by this paper
            </summary>
            <p className="mt-2 text-xs text-muted-foreground">{referencesNote}</p>
            <ul className="mt-3 space-y-2">
              {references.map((ref) => (
                <li key={ref.id} className="text-sm">
                  <Link
                    href={`/sources/${encodeURIComponent(ref.id)}`}
                    className="hover:text-primary hover:underline"
                  >
                    {ref.title}
                  </Link>
                  {ref.year != null && (
                    <span className="text-muted-foreground"> ({ref.year})</span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        </section>

        <p className="mt-8 text-xs text-muted-foreground">
          Retrieved {new Date(record.retrievedAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          {" "}· Sources: {record.providers.join(", ")}
        </p>
      </article>
    </main>
  );
}
