/**
 * Brave Search adapter — broader web discovery: reports, institutional
 * resources, theses, datasets, and available PDFs. Web results are clearly
 * distinguished from scholarly metadata. Server-side only, behind a
 * configured subscription key.
 *
 * Docs: https://api-dashboard.search.brave.com/app/documentation/web-search/get-started
 */

import {
  providerFetchJson,
  type ProviderCapabilities,
} from "@/lib/search/providers/base";
import type {
  ProviderId,
  ResourceLocation,
  ResourceRecord,
} from "@/lib/search/types";

const BASE = "https://api.search.brave.com/res/v1/web/search";

export const braveCapabilities: ProviderCapabilities = {
  search: true,
  getResource: false,
  doiLookup: false,
  openAccessResolve: false,
  references: false,
};

const PROVIDER: ProviderId = "brave";

export interface BraveConfig {
  subscriptionKey?: string;
}

interface BraveResult {
  title?: string;
  url?: string;
  description?: string;
  page_age?: string;
}

interface BraveResponse {
  web?: { results?: BraveResult[] };
}

/** Map a web result to a clearly-labeled web resource. */
export function mapWebResult(result: BraveResult, index: number): ResourceRecord {
  const retrievedAt = new Date().toISOString();
  const url = result.url ?? "";
  const locations: ResourceLocation[] = url
    ? [{
        url,
        label: "Web page",
        accessStatus: "link-reported",
        source: PROVIDER,
        retrievedAt,
      }]
    : [];

  return {
    id: `${PROVIDER}:web-${simpleHash(url) || String(index)}`,
    title: result.title ?? "Untitled web page",
    authors: [], // web results have no author metadata
    year: null,
    publishedDate: result.page_age ?? null,
    resourceType: "webpage",
    venue: hostOf(url),
    publisher: null,
    volume: null,
    issue: null,
    pages: null,
    language: null,
    doi: null,
    identifiers: [],
    abstract: result.description ?? null,
    abstractKind: "web-snippet",
    locations,
    citationCount: null,
    isRetracted: null,
    providers: [PROVIDER],
    retrievedAt,
  };
}

export async function searchBrave(
  config: BraveConfig,
  params: { query: string; count: number },
): Promise<ResourceRecord[]> {
  if (!config.subscriptionKey) {
    return Promise.reject(new Error("not-configured"));
  }
  const url = new URL(BASE);
  url.searchParams.set("q", params.query);
  url.searchParams.set("count", String(Math.min(params.count, 20)));
  const data = await providerFetchJson<BraveResponse>(url.toString(), {
    headers: { "X-Subscription-Token": config.subscriptionKey },
  });
  return (data.web?.results ?? []).map(mapWebResult);
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function simpleHash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}
