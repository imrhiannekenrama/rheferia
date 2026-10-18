/**
 * Semantic Scholar adapter — optional extra scholarly discovery and
 * related-paper data. Only active when a configured API key is present.
 *
 * Docs: https://api.semanticscholar.org/api-docs/
 */

import {
  providerFetchJson,
  type ProviderCapabilities,
} from "@/lib/search/providers/base";
import { normalizeDoi } from "@/lib/search/normalization";
import type {
  AuthorName,
  ProviderId,
  ResourceLocation,
  ResourceRecord,
} from "@/lib/search/types";

const BASE = "https://api.semanticscholar.org/graph/v1";

export const semanticScholarCapabilities: ProviderCapabilities = {
  search: true,
  getResource: true,
  doiLookup: true,
  openAccessResolve: false,
  references: true,
};

const PROVIDER: ProviderId = "semantic-scholar";

export interface SemanticScholarConfig {
  apiKey?: string;
}

interface SSPaper {
  paperId?: string;
  title?: string;
  abstract?: string | null;
  year?: number | null;
  venue?: string | null;
  publicationVenue?: { name?: string } | null;
  publicationDate?: string | null;
  authors?: Array<{ name?: string }>;
  externalIds?: { DOI?: string; CorpusId?: number };
  citationCount?: number | null;
  openAccessPdf?: { url?: string; status?: string; license?: string | null } | null;
  publicationTypes?: string[];
}

interface SSResponse {
  total?: number;
  data?: SSPaper[];
}

function mapPaper(paper: SSPaper): ResourceRecord {
  const retrievedAt = new Date().toISOString();
  const doi = paper.externalIds?.DOI
    ? normalizeDoi(paper.externalIds.DOI)
    : null;
  const nativeId = paper.paperId ?? "";

  const authors: AuthorName[] = (paper.authors ?? []).map((a) => ({
    raw: a.name ?? "Unknown",
  }));

  const locations: ResourceLocation[] = [];
  const oaPdf = paper.openAccessPdf;
  if (oaPdf?.url) {
    locations.push({
      url: oaPdf.url,
      label: "Open-access PDF",
      accessStatus: "link-reported",
      license: oaPdf.license ?? undefined,
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
    id: `${PROVIDER}:${nativeId}`,
    title: paper.title ?? "Untitled record",
    authors,
    year: paper.year ?? null,
    publishedDate: paper.publicationDate ?? null,
    resourceType: "journal-article", // S2 does not send a precise type; honest generic
    venue: paper.venue ?? paper.publicationVenue?.name ?? null,
    publisher: null,
    volume: null,
    issue: null,
    pages: null,
    language: null,
    doi,
    identifiers: nativeId ? [{ provider: PROVIDER, id: nativeId }] : [],
    abstract: paper.abstract ?? null,
    abstractKind: paper.abstract ? "abstract" : null,
    locations,
    citationCount: paper.citationCount ?? null,
    isRetracted: null,
    providers: [PROVIDER],
    retrievedAt,
  };
}

export async function searchSemanticScholar(
  config: SemanticScholarConfig,
  params: { query: string; limit: number },
): Promise<ResourceRecord[]> {
  if (!config.apiKey) {
    return Promise.reject(new Error("not-configured"));
  }
  const url = new URL(`${BASE}/paper/search`);
  url.searchParams.set("query", params.query);
  url.searchParams.set("limit", String(Math.min(params.limit, 20)));
  url.searchParams.set(
    "fields",
    "paperId,title,abstract,year,venue,publicationVenue,publicationDate,authors,externalIds,citationCount,openAccessPdf",
  );
  const data = await providerFetchJson<SSResponse>(url.toString(), {
    headers: { "x-api-key": config.apiKey },
  });
  return (data.data ?? []).map(mapPaper);
}

export async function getSemanticScholarByDoi(
  config: SemanticScholarConfig,
  doi: string,
): Promise<ResourceRecord> {
  if (!config.apiKey) {
    return Promise.reject(new Error("not-configured"));
  }
  const url = new URL(`${BASE}/paper/DOI:${normalizeDoi(doi)}`);
  url.searchParams.set("fields", "paperId,title,abstract,year,venue,publicationVenue,publicationDate,authors,externalIds,citationCount,openAccessPdf");
  const paper = await providerFetchJson<SSPaper>(url.toString(), {
    headers: { "x-api-key": config.apiKey },
  });
  return mapPaper(paper);
}
