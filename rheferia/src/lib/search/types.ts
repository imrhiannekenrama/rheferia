/**
 * Rheferia search contracts. Nullable data must stay nullable: a missing
 * value is never coerced to a fake zero, empty string, or invented text.
 */

export type ProviderId =
  | "openalex"
  | "crossref"
  | "unpaywall"
  | "semantic-scholar"
  | "brave";

export type ResourceType =
  | "journal-article"
  | "preprint"
  | "book"
  | "book-chapter"
  | "conference-paper"
  | "thesis"
  | "report"
  | "dataset"
  | "webpage"
  | "other";

export type AccessStatus =
  | "open-access" // reliable resolver says a full text is available
  | "link-reported" // a link exists but the file is unconfirmed
  | "source-access-required" // likely paywalled / institutional access
  | "metadata-only" // no suitable full-text link known
  | "unknown"; // metadata does not establish access

export type SearchMode =
  | "auto" // detect DOI / title / keywords automatically
  | "doi" // a DOI was detected; resolve directly
  | "title-question" // proposed study title or research question
  | "exact-title" // existing paper title, prioritize near-exact matches
  | "keywords"
  | "advanced";

export type SortOrder = "relevance" | "newest" | "oldest" | "citations";

export interface AuthorName {
  /** Display form exactly as supplied by the provider. */
  raw: string;
  given?: string;
  family?: string;
  orcid?: string;
  isOrganization?: boolean;
}

export interface ResourceIdentifier {
  provider: ProviderId;
  /** Provider-native id (OpenAlex W-id, Crossref DOI, etc.). */
  id: string;
}

export interface ResourceLocation {
  url: string;
  /** Human label, e.g. "Open-access PDF", "Publisher page", "Web result". */
  label: string;
  accessStatus: AccessStatus;
  license?: string;
  /** Which provider supplied this location, for provenance. */
  source: ProviderId;
  retrievedAt: string; // ISO 8601 UTC
}

export interface MatchEvidence {
  /** Concrete terms that matched the query, shown to the user. */
  matchedTerms: string[];
  /** Internal deterministic relevance score. Not a quality or accuracy claim. */
  score: number;
  /** Short, evidence-based relevance label. Never a fabricated accuracy %. */
  label: "strong-topic-match" | "topical-match" | "related" | "exact-match";
}

export interface ResourceRecord {
  /** Opaque stable id: `${provider}:${nativeId}` (URL-safe in a path segment after encodeURIComponent). */
  id: string;
  title: string;
  authors: AuthorName[];
  year: number | null;
  /** Full publication date when known (ISO 8601). */
  publishedDate: string | null;
  resourceType: ResourceType;
  venue: string | null;
  publisher: string | null;
  /** Bibliographic details; null when the provider does not supply them. */
  volume: string | null;
  issue: string | null;
  pages: string | null;
  language: string | null;
  doi: string | null;
  identifiers: ResourceIdentifier[];
  abstract: string | null;
  /** What kind of text `abstract` is, honestly labeled. */
  abstractKind: "abstract" | "web-snippet" | null;
  locations: ResourceLocation[];
  citationCount: number | null;
  isRetracted: boolean | null;
  /** Providers that contributed to this merged record. */
  providers: ProviderId[];
  retrievedAt: string; // ISO 8601 UTC
  match?: MatchEvidence;
}

export type ProviderState =
  | "ok"
  | "not-configured"
  | "no-matches"
  | "rate-limited"
  | "timed-out"
  | "error"
  | "skipped";

export interface ProviderStatus {
  provider: ProviderId;
  state: ProviderState;
  /** Safe, user-facing detail. Never contains keys or raw errors. */
  message?: string;
  resultCount?: number;
}

export interface SearchFilters {
  yearFrom?: number;
  yearTo?: number;
  resourceTypes?: ResourceType[];
  openAccessOnly?: boolean;
  providers?: ProviderId[];
  language?: string;
  /** Advanced mode extras */
  allTerms?: string;
  exactPhrase?: string;
  excludedTerms?: string;
  author?: string;
}

export interface QueryPlan {
  mode: SearchMode;
  detectedDoi: string | null;
  /** Editable concept keywords extracted from a long title/question. */
  keywords: string[];
  /** The bounded set of query strings sent to providers. */
  queries: string[];
  broadened: boolean;
}

export interface SearchRequest {
  query: string;
  mode: SearchMode;
  filters: SearchFilters;
  sort: SortOrder;
  cursor?: string;
  pageSize?: number;
}

export interface SearchResponse {
  results: ResourceRecord[];
  nextCursor: string | null;
  providerStatuses: ProviderStatus[];
  queryPlan: QueryPlan | null;
  /** Honest coverage note, e.g. which providers answered. */
  coverageNote: string | null;
}

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  "journal-article": "Journal article",
  preprint: "Preprint",
  book: "Book",
  "book-chapter": "Book chapter",
  "conference-paper": "Conference paper",
  thesis: "Thesis",
  report: "Report",
  dataset: "Dataset",
  webpage: "Web page",
  other: "Resource",
};

export const ACCESS_STATUS_LABELS: Record<AccessStatus, string> = {
  "open-access": "Open-access full text available",
  "link-reported": "Full-text link reported",
  "source-access-required": "Source access required",
  "metadata-only": "Metadata only",
  unknown: "Access status unknown",
};
