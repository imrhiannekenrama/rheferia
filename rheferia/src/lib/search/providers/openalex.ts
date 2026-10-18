/**
 * OpenAlex adapter — core scholarly discovery, bibliographic details, and
 * reference graph data. Works without a key (polite pool) with optional
 * configured key support. Implements the current official REST API.
 *
 * Docs: https://help.openalex.org/api/
 */

import {
  providerFetchJson,
  ProviderFetchError,
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

const BASE = "https://api.openalex.org";

export const openAlexCapabilities: ProviderCapabilities = {
  search: true,
  getResource: true,
  doiLookup: true,
  openAccessResolve: false,
  references: true,
};

const PROVIDER: ProviderId = "openalex";

export interface OpenAlexConfig {
  apiKey?: string;
  /** Polite contact email improves the shared pool; optional. */
  contactEmail?: string;
}

function commonParams(config: OpenAlexConfig): URLSearchParams {
  const params = new URLSearchParams();
  if (config.apiKey) params.set("api_key", config.apiKey);
  if (config.contactEmail) params.set("mailto", config.contactEmail);
  return params;
}

/** OpenAlex type → Rheferia resource type mapping. */
const TYPE_MAP: Record<string, ResourceType> = {
  article: "journal-article",
  preprint: "preprint",
  book: "book",
  "book-chapter": "book-chapter",
  proceedings_article: "conference-paper",
  dissertation: "thesis",
  report: "report",
  dataset: "dataset",
};

/* ----------------------------------- raw shapes ---------------------------------- */

interface OAInvertedIndex {
  [word: string]: number[];
}

interface OAAuthorship {
  author: { id?: string; display_name?: string; orcid?: string | null } | null;
  raw_author_name?: string | null;
}

interface OALocation {
  source?: {
    id?: string;
    display_name?: string;
    type?: string;
    is_oa?: boolean;
  } | null;
  is_oa?: boolean;
  pdf_url?: string | null;
  landing_page_url?: string | null;
  license?: string | null;
  version?: string | null;
}

interface OAWork {
  id?: string;
  doi?: string | null;
  title?: string | null;
  display_name?: string | null;
  publication_year?: number | null;
  publication_date?: string | null;
  type?: string | null;
  language?: string | null;
  authorships?: OAAuthorship[];
  primary_location?: OALocation | null;
  best_oa_location?: OALocation | null;
  locations?: OALocation[];
  cited_by_count?: number;
  abstract_inverted_index?: OAInvertedIndex | null;
  is_retracted?: boolean;
  referenced_works?: string[];
  biblio?: {
    volume?: string | null;
    issue?: string | null;
    first_page?: string | null;
    last_page?: string | null;
  } | null;
}

interface OAResponse {
  meta?: { count?: number };
  results?: OAWork[];
}

/* ------------------------------------ mapping ------------------------------------ */

/** Rebuild abstract text from OpenAlex's inverted index. */
export function rebuildAbstract(inverted: OAInvertedIndex | null | undefined): string | null {
  if (!inverted) return null;
  const pairs: Array<[number, string]> = [];
  for (const [word, positions] of Object.entries(inverted)) {
    for (const pos of positions ?? []) pairs.push([pos, word]);
  }
  if (pairs.length === 0) return null;
  pairs.sort((a, b) => a[0] - b[0]);
  return pairs.map(([, w]) => w).join(" ");
}

export function mapWork(work: OAWork): ResourceRecord {
  const id = work.id?.replace("https://openalex.org/", "") ?? "";
  const doi = work.doi ? normalizeDoi(work.doi) : null;

  const authors: AuthorName[] = (work.authorships ?? []).map((a) => ({
    raw: a.raw_author_name ?? a.author?.display_name ?? "Unknown",
    orcid: a.author?.orcid ?? undefined,
    isOrganization:
      a.author?.display_name != null && a.raw_author_name == null &&
      (a.author.id?.includes("A") ?? false) && a.raw_author_name === undefined
        ? undefined
        : undefined,
  }));

  const locations: ResourceLocation[] = [];
  const retrievedAt = new Date().toISOString();
  const best = work.best_oa_location;
  if (best?.pdf_url) {
    locations.push({
      url: best.pdf_url,
      label: "Open-access PDF",
      accessStatus: best.is_oa === false ? "link-reported" : "open-access",
      license: best.license ?? undefined,
      source: PROVIDER,
      retrievedAt,
    });
  }
  const primary = work.primary_location;
  if (primary?.landing_page_url) {
    locations.push({
      url: primary.landing_page_url,
      label: primary.source?.display_name ?? "Publisher page",
      accessStatus: "source-access-required",
      source: PROVIDER,
      retrievedAt,
    });
  }

  return {
    id: `${PROVIDER}:${id}`,
    title: work.title ?? work.display_name ?? "Untitled record",
    authors,
    year: work.publication_year ?? null,
    publishedDate: work.publication_date ?? null,
    resourceType: (work.type && TYPE_MAP[work.type]) || "other",
    venue: work.primary_location?.source?.display_name ?? null,
    publisher: null,
    volume: work.biblio?.volume ?? null,
    issue: work.biblio?.issue ?? null,
    pages:
      work.biblio?.first_page && work.biblio?.last_page
        ? `${work.biblio.first_page}-${work.biblio.last_page}`
        : (work.biblio?.first_page ?? null),
    language: work.language ?? null,
    doi,
    identifiers: [{ provider: PROVIDER, id }],
    abstract: rebuildAbstract(work.abstract_inverted_index),
    abstractKind: work.abstract_inverted_index ? "abstract" : null,
    locations,
    citationCount: work.cited_by_count ?? null,
    isRetracted: work.is_retracted ?? null,
    providers: [PROVIDER],
    retrievedAt,
  };
}

/* ------------------------------------ queries ------------------------------------ */

export interface OpenAlexSearchParams {
  query: string;
  perPage: number;
  filters?: SearchFilters;
}

/** Translate Rheferia filters into OpenAlex filter parameters. */
export function buildFilterParams(filters: SearchFilters | undefined): URLSearchParams {
  const params = new URLSearchParams();
  if (!filters) return params;
  const f: string[] = [];
  if (filters.yearFrom) f.push(`from_publication_date:${filters.yearFrom}-01-01`);
  if (filters.yearTo) f.push(`to_publication_date:${filters.yearTo}-12-31`);
  if (filters.openAccessOnly) f.push("open_access.is_oa:true");
  const typeMap: Record<string, string> = {
    "journal-article": "article",
    preprint: "preprint",
    book: "book",
    "book-chapter": "book-chapter",
    "conference-paper": "proceedings_article",
    thesis: "dissertation",
    report: "report",
    dataset: "dataset",
  };
  const types = (filters.resourceTypes ?? [])
    .map((t) => typeMap[t])
    .filter(Boolean);
  if (types.length > 0) f.push(`type:${types.join("|")}`);
  if (filters.author) f.push(`raw_author_name.search:${filters.author}`);
  if (f.length > 0) params.set("filter", f.join(","));
  return params;
}

export async function searchOpenAlex(
  config: OpenAlexConfig,
  params: OpenAlexSearchParams,
): Promise<ResourceRecord[]> {
  const url = new URL(`${BASE}/works`);
  url.searchParams.set("search", params.query);
  url.searchParams.set("per-page", String(Math.min(params.perPage, 50)));
  const extra = buildFilterParams(params.filters);
  for (const [k, v] of extra) url.searchParams.append(k === "filter" ? "filter" : k, v);
  for (const [k, v] of commonParams(config)) url.searchParams.append(k, v);

  const data = await providerFetchJson<OAResponse>(url.toString());
  return (data.results ?? []).map(mapWork);
}

export async function getOpenAlexWork(
  config: OpenAlexConfig,
  nativeId: string,
): Promise<ResourceRecord> {
  const id = nativeId.replace(/^https?:\/\/openalex\.org\//, "");
  const url = new URL(`${BASE}/works/${encodeURIComponent(id)}`);
  for (const [k, v] of commonParams(config)) url.searchParams.append(k, v);
  const work = await providerFetchJson<OAWork>(url.toString());
  return mapWork(work);
}

export async function getOpenAlexByDoi(
  config: OpenAlexConfig,
  doi: string,
): Promise<ResourceRecord> {
  const url = new URL(`${BASE}/works/doi:${normalizeDoi(doi)}`);
  for (const [k, v] of commonParams(config)) url.searchParams.append(k, v);
  const work = await providerFetchJson<OAWork>(url.toString());
  return mapWork(work);
}

/**
 * References cited by one work, bounded: OpenAlex lets us filter by up to
 * 50 ids per batch. Returns native OpenAlex ids of cited works.
 */
export async function getReferencedWorkIds(
  config: OpenAlexConfig,
  nativeId: string,
  limit = 50,
): Promise<string[]> {
  const url = new URL(`${BASE}/works/${encodeURIComponent(nativeId)}`);
  url.searchParams.set("select", "referenced_works");
  for (const [k, v] of commonParams(config)) url.searchParams.append(k, v);
  const work = await providerFetchJson<{ referenced_works?: string[] }>(url.toString());
  return (work.referenced_works ?? [])
    .map((w) => w.replace("https://openalex.org/", ""))
    .slice(0, limit);
}

/** Batch-resolve OpenAlex ids to minimal records (title/year/doi). */
export async function getWorksByIds(
  config: OpenAlexConfig,
  ids: string[],
): Promise<Array<Pick<ResourceRecord, "id" | "title" | "year" | "doi">>> {
  if (ids.length === 0) return [];
  const url = new URL(`${BASE}/works`);
  url.searchParams.set("filter", `openalex_id:${ids.slice(0, 50).join("|")}`);
  url.searchParams.set("select", "id,display_name,publication_year,doi");
  url.searchParams.set("per-page", "50");
  for (const [k, v] of commonParams(config)) url.searchParams.append(k, v);
  const data = await providerFetchJson<OAResponse>(url.toString());
  return (data.results ?? []).map((w) => ({
    id: `${PROVIDER}:${w.id?.replace("https://openalex.org/", "") ?? ""}`,
    title: w.display_name ?? "Untitled record",
    year: w.publication_year ?? null,
    doi: w.doi ? normalizeDoi(w.doi) : null,
  }));
}

export { ProviderFetchError };
