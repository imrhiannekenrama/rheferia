/**
 * Citation engine contracts.
 *
 * Honest-data rule: a missing value stays missing and is flagged for the
 * user to review. The formatter never invents a page range, volume,
 * year (n.d. excepted, per style rules), or publisher.
 */

import type { ResourceType } from "@/lib/search/types";

export type CitationStyle = "apa" | "mla" | "chicago" | "ieee" | "vancouver" | "harvard";

export const CITATION_STYLES: { id: CitationStyle; label: string; note: string }[] = [
  { id: "apa", label: "APA 7", note: "Author-date reference list" },
  { id: "mla", label: "MLA 9", note: "Works-cited list" },
  { id: "chicago", label: "Chicago 17", note: "Bibliography (author-date in-text)" },
  { id: "ieee", label: "IEEE", note: "Numbered reference list" },
  { id: "vancouver", label: "Vancouver", note: "Numbered reference list (ICMJE)" },
  { id: "harvard", label: "Harvard", note: "Author-date reference list" },
];

export interface CitationData {
  /** Stable id from the search record, e.g. "openalex:W123". */
  recordId: string;
  authors: { family?: string; given?: string; raw: string; isOrganization?: boolean }[];
  year: number | null;
  title: string;
  resourceType: ResourceType;
  /** Journal name, book container, site name, etc. */
  container: string | null;
  publisher: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  doi: string | null;
  url: string | null;
  edition: string | null;
}

/** Fields the record metadata lacks; surfaced as "review this" flags. */
export type MissingField =
  | "authors"
  | "year"
  | "container"
  | "volume"
  | "issue"
  | "pages"
  | "doi"
  | "publisher";

export interface FormattedCitation {
  /** Full reference-list entry in the chosen style. */
  reference: string;
  /** In-text form (or [n] marker for numbered styles). */
  inText: string;
  /** Missing metadata the user should review before submitting. */
  missingFields: MissingField[];
  style: CitationStyle;
}

export function findMissingFields(data: CitationData): MissingField[] {
  const missing: MissingField[] = [];
  const needsPageNumbers =
    data.resourceType === "journal-article" || data.resourceType === "book-chapter";
  if (data.authors.length === 0) missing.push("authors");
  if (data.year == null) missing.push("year");
  if (!data.container && (data.resourceType === "journal-article" || data.resourceType === "book-chapter")) {
    missing.push("container");
  }
  if (!data.volume && data.resourceType === "journal-article") missing.push("volume");
  if (!data.pages && needsPageNumbers) missing.push("pages");
  if (!data.doi) missing.push("doi");
  if (!data.publisher && (data.resourceType === "book" || data.resourceType === "report")) {
    missing.push("publisher");
  }
  return missing;
}
