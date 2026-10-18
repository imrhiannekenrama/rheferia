/**
 * ResourceRecord → CitationData. Maps only what the record actually has;
 * volume/issue/pages come from provider bibliographic fields and stay
 * null when the provider does not supply them (flagged for review).
 */

import type { ResourceRecord } from "@/lib/search/types";
import type { CitationData } from "@/lib/citations/types";

function normalizeDoi(doi: string): string {
  const trimmed = doi.trim();
  return trimmed
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:/i, "")
    .toLowerCase();
}

function bestUrl(record: ResourceRecord): string | null {
  if (record.doi) return `https://doi.org/${record.doi}`;
  const oa = record.locations.find((l) => l.accessStatus === "open-access");
  return oa?.url ?? record.locations[0]?.url ?? null;
}

export function recordToCitation(record: ResourceRecord): CitationData {
  return {
    recordId: record.id,
    authors: record.authors.map((a) => ({
      family: a.family,
      given: a.given,
      raw: a.raw,
      isOrganization: a.isOrganization,
    })),
    year: record.year,
    title: record.title,
    resourceType: record.resourceType,
    container: record.venue,
    publisher: record.publisher,
    volume: record.volume,
    issue: record.issue,
    pages: record.pages,
    doi: record.doi ? normalizeDoi(record.doi) : null,
    url: bestUrl(record),
    edition: null,
  };
}
