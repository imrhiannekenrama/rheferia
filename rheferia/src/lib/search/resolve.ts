/**
 * Resolve an opaque record id back to a full ResourceRecord.
 * A source must remain resolvable on refresh: ids are `${provider}:${nativeId}`.
 */

import "server-only";
import { searchProviderConfig } from "@/lib/config/env";
import {
  getOpenAlexByDoi,
  getOpenAlexWork,
} from "@/lib/search/providers/openalex";
import { getCrossrefByDoi } from "@/lib/search/providers/crossref";
import { enrichWithUnpaywall } from "@/lib/search/providers/unpaywall";
import type { ResourceRecord } from "@/lib/search/types";

export async function resolveResource(
  encodedId: string,
): Promise<ResourceRecord | null> {
  const id = decodeURIComponent(encodedId);
  const separator = id.indexOf(":");
  if (separator <= 0) return null;
  const provider = id.slice(0, separator);
  const nativeId = id.slice(separator + 1);
  if (!nativeId) return null;

  const config = searchProviderConfig();

  let record: ResourceRecord | null = null;
  try {
    if (provider === "openalex") {
      record = await getOpenAlexWork(
        { apiKey: config.openalexApiKey, contactEmail: config.crossrefContactEmail },
        nativeId,
      );
    } else if (provider === "crossref") {
      record = await getCrossrefByDoi(
        { contactEmail: config.crossrefContactEmail },
        nativeId,
      );
    } else if (provider === "doi" || /^10\./.test(nativeId)) {
      record = await getCrossrefByDoi(
        { contactEmail: config.crossrefContactEmail },
        nativeId,
      );
      const oa = await getOpenAlexByDoi(
        { apiKey: config.openalexApiKey, contactEmail: config.crossrefContactEmail },
        nativeId,
      );
      if (oa) {
        record = record
          ? {
              ...record,
              abstract: record.abstract ?? oa.abstract,
              citationCount: record.citationCount ?? oa.citationCount,
              locations: [...oa.locations, ...record.locations],
              providers: [...new Set([...record.providers, ...oa.providers])],
            }
          : oa;
      }
    }
  } catch {
    return null;
  }

  if (record && record.doi && config.unpaywallEmail) {
    record = await enrichWithUnpaywall({ email: config.unpaywallEmail }, record);
  }
  return record;
}
