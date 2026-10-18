/**
 * Unpaywall adapter — DOI-based open-access resolution only (the retired
 * general-search endpoint is NOT used). Requires a configured contact
 * email per Unpaywall's API terms.
 *
 * Docs: https://data.unpaywall.org/products/api
 */

import {
  providerFetchJson,
  type ProviderCapabilities,
} from "@/lib/search/providers/base";
import { normalizeDoi } from "@/lib/search/normalization";
import type {
  ProviderId,
  ResourceLocation,
  ResourceRecord,
} from "@/lib/search/types";

const BASE = "https://api.unpaywall.org/v2";

export const unpaywallCapabilities: ProviderCapabilities = {
  search: false,
  getResource: false,
  doiLookup: true,
  openAccessResolve: true,
  references: false,
};

const PROVIDER: ProviderId = "unpaywall";

export interface UnpaywallConfig {
  /** Required by the API. Empty = adapter reports not-configured. */
  email?: string;
}

interface UPLocation {
  url_for_pdf?: string;
  url?: string;
  host_type?: string;
  version?: string;
  license?: string | null;
}

interface UPResponse {
  doi?: string;
  is_oa?: boolean;
  oa_status?: string;
  best_oa_location?: UPLocation | null;
}

export interface OpenAccessResult {
  isOa: boolean;
  oaStatus: string | null;
  location: ResourceLocation | null;
}

/** Resolve the open-access state of one DOI. Returns null when unknown. */
export async function resolveOpenAccess(
  config: UnpaywallConfig,
  doi: string,
): Promise<OpenAccessResult | null> {
  if (!config.email) return null; // honestly not configured
  const url = `${BASE}/${encodeURIComponent(normalizeDoi(doi))}?email=${encodeURIComponent(config.email)}`;
  const data = await providerFetchJson<UPResponse>(url);
  const best = data.best_oa_location;
  const retrievedAt = new Date().toISOString();
  return {
    isOa: data.is_oa === true,
    oaStatus: data.oa_status ?? null,
    location: best
      ? {
          url: best.url_for_pdf ?? best.url ?? `https://doi.org/${normalizeDoi(doi)}`,
          label: data.is_oa ? "Open-access copy" : "Possible access location",
          accessStatus: data.is_oa
            ? best.url_for_pdf
              ? "open-access"
              : "link-reported"
            : "source-access-required",
          license: best.license ?? undefined,
          source: PROVIDER,
          retrievedAt,
        }
      : null,
  };
}

/** Enrich a record with Unpaywall access evidence (mutates a copy). */
export async function enrichWithUnpaywall(
  config: UnpaywallConfig,
  record: ResourceRecord,
): Promise<ResourceRecord> {
  if (!record.doi || !config.email) return record;
  try {
    const result = await resolveOpenAccess(config, record.doi);
    if (!result) return record;
    const locations = [...record.locations];
    if (result.location) locations.unshift(result.location);
    return {
      ...record,
      locations,
      providers: record.providers.includes(PROVIDER)
        ? record.providers
        : [...record.providers, PROVIDER],
    };
  } catch {
    return record; // enrichment is best-effort; never block the result
  }
}
