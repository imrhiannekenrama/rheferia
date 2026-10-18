/**
 * Deduplication across providers: normalized DOI first, then stable
 * provider ids, then conservative title/author/year matching. Preprints
 * and published versions are kept separate unless keys prove identity.
 */

import {
  normalizeDoi,
  titleSimilarity,
  firstAuthorFingerprint,
} from "@/lib/search/normalization";
import type { ResourceRecord } from "@/lib/search/types";

/** Minimum title similarity for the conservative title-match key. */
const TITLE_MATCH_THRESHOLD = 0.82;

/** Stable dedup key for a record, or null when no strong key exists. */
function strongKey(record: ResourceRecord): string | null {
  if (record.doi) return `doi:${normalizeDoi(record.doi)}`;
  // Stable provider ids: OpenAlex ids and Crossref DOIs are canonical.
  const oa = record.identifiers.find((i) => i.provider === "openalex");
  if (oa) return `openalex:${oa.id}`;
  const cr = record.identifiers.find((i) => i.provider === "crossref");
  if (cr) return `crossref:${normalizeDoi(cr.id)}`;
  return null;
}

/**
 * Merge two records describing the same resource. Field-level winner is
 * the richer value; provenance (providers, identifiers) is unioned.
 */
export function mergeRecords(a: ResourceRecord, b: ResourceRecord): ResourceRecord {
  const providers = [...new Set([...a.providers, ...b.providers])];
  const identifiers = [...a.identifiers];
  for (const id of b.identifiers) {
    if (!identifiers.some((x) => x.provider === id.provider && x.id === id.id)) {
      identifiers.push(id);
    }
  }
  const locations = [...a.locations];
  for (const loc of b.locations) {
    if (!locations.some((x) => x.url === loc.url)) locations.push(loc);
  }

  const prefer = <T>(x: T | null | undefined, y: T | null | undefined): T | null =>
    (x ?? null) ?? (y ?? null);

  return {
    id: a.id, // keep the first, stable, resolvable id
    title: a.title.length >= b.title.length ? a.title : b.title,
    authors: a.authors.length >= b.authors.length ? a.authors : b.authors,
    year: prefer(a.year, b.year),
    publishedDate: prefer(a.publishedDate, b.publishedDate),
    resourceType: a.resourceType === "other" ? b.resourceType : a.resourceType,
    venue: prefer(a.venue, b.venue),
    volume: prefer(a.volume, b.volume),
    issue: prefer(a.issue, b.issue),
    pages: prefer(a.pages, b.pages),
    publisher: prefer(a.publisher, b.publisher),
    language: prefer(a.language, b.language),
    doi: prefer(a.doi, b.doi),
    identifiers,
    abstract: prefer(a.abstract, b.abstract),
    abstractKind: a.abstract ? a.abstractKind : b.abstractKind,
    locations,
    citationCount: prefer(a.citationCount, b.citationCount),
    isRetracted: prefer(a.isRetracted, b.isRetracted),
    providers,
    retrievedAt: a.retrievedAt,
    match: a.match ?? b.match,
  };
}

/**
 * Deduplicate a merged result list. O(n²) over the (bounded) result set,
 * keyed by DOI → provider id → conservative title+author+year.
 */
export function dedupeRecords(records: ResourceRecord[]): ResourceRecord[] {
  const byStrongKey = new Map<string, ResourceRecord>();
  const leftovers: ResourceRecord[] = [];

  for (const record of records) {
    const key = strongKey(record);
    if (!key) {
      leftovers.push(record);
      continue;
    }
    const existing = byStrongKey.get(key);
    byStrongKey.set(key, existing ? mergeRecords(existing, record) : record);
  }

  // Conservative pass over records without strong keys.
  const mergedList = [...byStrongKey.values()];
  const result: ResourceRecord[] = [];
  for (const record of leftovers) {
    let matched = false;
    for (const candidate of mergedList) {
      if (sameResourceConservative(record, candidate)) {
        const idx = mergedList.indexOf(candidate);
        mergedList[idx] = mergeRecords(candidate, record);
        matched = true;
        break;
      }
    }
    if (!matched) result.push(record);
  }

  return [...mergedList, ...result];
}

/** Title+first-author+year similarity match, deliberately strict. */
export function sameResourceConservative(
  a: ResourceRecord,
  b: ResourceRecord,
): boolean {
  const sim = titleSimilarity(a.title, b.title);
  if (sim < TITLE_MATCH_THRESHOLD) return false;
  const aa = firstAuthorFingerprint(a.authors);
  const ba = firstAuthorFingerprint(b.authors);
  // If both have author info, they must agree loosely.
  if (aa && ba) {
    const shared = aa.split(" ").some((t) => ba.split(" ").includes(t) && t.length > 2);
    if (!shared) return false;
  }
  // If both have years, they must match exactly (preprint/published split kept).
  if (a.year != null && b.year != null && a.year !== b.year) return false;
  return true;
}
