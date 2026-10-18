/**
 * Crossref adapter — DOI metadata lookup and bibliographic search.
 * Metadata links are metadata, not proof of downloadable full text.
 *
 * Docs: https://www.crossref.org/documentation/retrieve-metadata/rest-api/
 */

import {
  providerFetchJson,
  type ProviderCapabilities,
} from "@/lib/search/providers/base";
import { normalizeDoi } from "@/lib/search/normalization";
import type {
  AuthorName,
  ProviderId,
  ResourceType,
  ResourceLocation,
  ResourceRecord,
  SearchFilters,
} from "@/lib/search/types";

const BASE = "https://api.crossref.org";

export const crossrefCapabilities: ProviderCapabilities = {
  search: true,
  getResource: true, // by DOI
  doiLookup: true,
  openAccessResolve: false,
  references: false,
};

const PROVIDER: ProviderId = "crossref";

export interface CrossrefConfig {
  /** Polite pool contact email, strongly recommended by Crossref. */
  contactEmail?: string;
}

const TYPE_MAP: Record<string, ResourceType> = {
  "journal-article": "journal-article",
  "book-chapter": "book-chapter",
  book: "book",
  "proceedings-article": "conference-paper",
  dissertation: "thesis",
  report: "report",
  dataset: "dataset",
  posted_content: "preprint",
};

interface CRLink {
  URL?: string;
  "content-type"?: string;
  "intended-application"?: string;
}

interface CRAuthor {
  given?: string;
  family?: string;
  name?: string; // organizational author
  ORCID?: string;
}

interface CRDateParts {
  "date-parts"?: number[][];
}

interface CRWork {
  DOI?: string;
  title?: string[];
  author?: CRAuthor[];
  issued?: CRDateParts;
  published?: CRDateParts;
  type?: string;
  "container-title"?: string[];
  publisher?: string;
  volume?: string;
  issue?: string;
  page?: string;
  language?: string;
  abstract?: string;
  "is-referenced-by-count"?: number;
  link?: CRLink[];
  license?: Array<{ URL?: string }>;
  subject?: string[];
}

interface CRResponse {
  status?: string;
  message?: CRWork | { items?: CRWork[]; "total-results"?: number };
}

/** Strip JATS/XML tags from a Crossref abstract for plain display. */
export function cleanCrossrefAbstract(abstract: string): string {
  return abstract
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapCrossrefWork(work: CRWork): ResourceRecord {
  const doi = work.DOI ? normalizeDoi(work.DOI) : null;
  const retrievedAt = new Date().toISOString();

  const authors: AuthorName[] = (work.author ?? []).map((a) => {
    if (a.name) {
      return { raw: a.name, isOrganization: true };
    }
    const given = a.given ?? "";
    const family = a.family ?? "";
    return {
      raw: `${given} ${family}`.trim() || "Unknown",
      given: given || undefined,
      family: family || undefined,
      orcid: a.ORCID,
    };
  });

  const dateParts =
    work.published?.["date-parts"]?.[0] ?? work.issued?.["date-parts"]?.[0] ?? [];
  const year = dateParts[0] ?? null;
  const publishedDate =
    dateParts.length >= 3
      ? `${dateParts[0]}-${String(dateParts[1]).padStart(2, "0")}-${String(dateParts[2]).padStart(2, "0")}`
      : year != null
        ? String(year)
        : null;

  const locations: ResourceLocation[] = [];
  for (const link of work.link ?? []) {
    const url = link.URL;
    if (!url) continue;
    const isPdf = (link["content-type"] ?? "").includes("pdf");
    locations.push({
      url,
      label: isPdf ? "Full-text link (unverified)" : "Publisher link",
      accessStatus: "link-reported", // metadata link, not verified downloadability
      source: PROVIDER,
      retrievedAt,
    });
  }
  if (doi) {
    locations.push({
      url: `https://doi.org/${doi}`,
      label: "Publisher page (via DOI)",
      accessStatus: "source-access-required",
      source: PROVIDER,
      retrievedAt,
    });
  }

  return {
    id: `${PROVIDER}:${doi ?? "unknown"}`,
    title: work.title?.[0] ?? "Untitled record",
    authors,
    year,
    publishedDate,
    resourceType: (work.type && TYPE_MAP[work.type]) || "other",
    venue: work["container-title"]?.[0] ?? null,
    publisher: work.publisher ?? null,
    volume: work.volume ?? null,
    issue: work.issue ?? null,
    pages: work.page ?? null,
    language: work.language ?? null,
    doi,
    identifiers: doi ? [{ provider: PROVIDER, id: doi }] : [],
    abstract: work.abstract ? cleanCrossrefAbstract(work.abstract) : null,
    abstractKind: work.abstract ? "abstract" : null,
    locations,
    citationCount: work["is-referenced-by-count"] ?? null,
    isRetracted: null,
    providers: [PROVIDER],
    retrievedAt,
  };
}

export async function searchCrossref(
  config: CrossrefConfig,
  params: { query: string; rows: number; filters?: SearchFilters },
): Promise<ResourceRecord[]> {
  const url = new URL(`${BASE}/works`);
  url.searchParams.set("query.bibliographic", params.query);
  url.searchParams.set("rows", String(Math.min(params.rows, 40)));
  if (config.contactEmail) url.searchParams.set("mailto", config.contactEmail);
  if (params.filters?.yearFrom) {
    url.searchParams.set("filter", `from-pub-date:${params.filters.yearFrom}-01-01`);
  }
  if (params.filters?.yearTo) {
    url.searchParams.set(
      "filter",
      `${url.searchParams.get("filter") ? url.searchParams.get("filter") + "," : ""}until-pub-date:${params.filters.yearTo}-12-31`,
    );
  }

  const data = await providerFetchJson<CRResponse>(url.toString());
  const items =
    (data.message as { items?: CRWork[] } | undefined)?.items ?? [];
  return items.map(mapCrossrefWork);
}

export async function getCrossrefByDoi(
  config: CrossrefConfig,
  doi: string,
): Promise<ResourceRecord> {
  const url = new URL(`${BASE}/works/${encodeURIComponent(normalizeDoi(doi))}`);
  if (config.contactEmail) url.searchParams.set("mailto", config.contactEmail);
  const data = await providerFetchJson<CRResponse>(url.toString());
  const work = data.message as CRWork | undefined;
  if (!work) {
    throw new Error("Crossref returned no record for this DOI");
  }
  return mapCrossrefWork(work);
}
