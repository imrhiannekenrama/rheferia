/**
 * Transparent, deterministic ranking. Recency and citation counts are
 * tie-breakers, never dominance. No fabricated "98% accurate" claims:
 * the user sees concrete matched terms and an internal score we are
 * willing to explain.
 */

import {
  tokenize,
  titleFingerprint,
} from "@/lib/search/normalization";
import type {
  MatchEvidence,
  ResourceRecord,
  SearchRequest,
} from "@/lib/search/types";

/** Weights (sum of the main terms ≈ 100). */
const W = {
  titleOverlap: 45,
  conceptMatch: 25,
  abstractEvidence: 15,
  hasAbstract: 5,
  openAccess: 5,
  recency: 3,
  citations: 2,
};

export function scoreRecord(record: ResourceRecord, request: SearchRequest): MatchEvidence {
  const queryTokens = new Set(tokenize(request.query));
  const titleTokens = tokenize(record.title);
  const abstractTokens = record.abstract ? tokenize(record.abstract) : [];

  // Title term overlap.
  let titleHits = 0;
  for (const t of titleTokens) if (queryTokens.has(t)) titleHits += 1;
  const titleOverlap =
    queryTokens.size === 0 ? 0 : titleHits / queryTokens.size;

  // Abstract evidence.
  let abstractHits = 0;
  for (const t of abstractTokens) if (queryTokens.has(t)) abstractHits += 1;
  const abstractEvidence =
    queryTokens.size === 0 ? 0 : Math.min(abstractHits / queryTokens.size, 1);

  // Matched terms the user can see.
  const matchedTerms = [
    ...new Set([...titleTokens, ...abstractTokens].filter((t) => queryTokens.has(t))),
  ].slice(0, 8);

  const currentYear = new Date().getFullYear();
  const age = record.year ? Math.max(0, currentYear - record.year) : null;
  const recency = age == null ? 0 : Math.max(0, 1 - age / 30); // 30-year ramp

  const citations = record.citationCount ?? 0;
  const citationBoost = citations > 0 ? Math.min(Math.log10(citations + 1) / 4, 1) : 0;

  const hasOpenAccess = record.locations.some(
    (l) => l.accessStatus === "open-access",
  );

  const score =
    W.titleOverlap * titleOverlap +
    W.conceptMatch * Math.min(matchedTerms.length / 4, 1) +
    W.abstractEvidence * abstractEvidence +
    (record.abstract ? W.hasAbstract : 0) +
    (hasOpenAccess ? W.openAccess : 0) +
    W.recency * recency +
    W.citations * citationBoost;

  const exact =
    titleFingerprint(record.title) === titleFingerprint(request.query);
  const normalized = Math.round(score * 10) / 10;

  let label: MatchEvidence["label"];
  if (exact) label = "exact-match";
  else if (score >= 40) label = "strong-topic-match";
  else if (score >= 18) label = "topical-match";
  else label = "related";

  return { matchedTerms, score: normalized, label };
}

/**
 * Rank + sort with stable tie-breaking so pagination never reorders.
 * Missing citation counts stay distinct from zero (null sorts last).
 */
export function rankAndSort(
  records: ResourceRecord[],
  request: SearchRequest,
): ResourceRecord[] {
  const scored = records.map((r) => ({
    record: r,
    evidence: scoreRecord(r, request),
  }));

  scored.sort((a, b) => {
    const { sort } = request;
    let cmp = 0;
    if (sort === "relevance") cmp = b.evidence.score - a.evidence.score;
    else if (sort === "newest") cmp = (b.record.year ?? -1) - (a.record.year ?? -1);
    else if (sort === "oldest") {
      const ay = a.record.year ?? Number.POSITIVE_INFINITY;
      const by = b.record.year ?? Number.POSITIVE_INFINITY;
      cmp = ay - by;
    } else if (sort === "citations") {
      const ac = a.record.citationCount ?? -1;
      const bc = b.record.citationCount ?? -1;
      cmp = bc - ac;
    }
    if (cmp !== 0) return cmp;
    // Relevance always breaks ties, then a stable fingerprint.
    const rel = b.evidence.score - a.evidence.score;
    if (rel !== 0) return rel;
    return titleFingerprint(a.record.title).localeCompare(titleFingerprint(b.record.title));
  });

  return scored.map(({ record, evidence }) => ({ ...record, match: evidence }));
}

/** Apply post-search user filters to a merged, ranked snapshot. */
export function applyFilters(
  records: ResourceRecord[],
  request: SearchRequest,
): ResourceRecord[] {
  const { filters } = request;
  return records.filter((r) => {
    if (filters.yearFrom && (r.year ?? 0) < filters.yearFrom) return false;
    if (filters.yearTo && (r.year ?? 9999) > filters.yearTo) return false;
    if (filters.resourceTypes && filters.resourceTypes.length > 0) {
      if (!filters.resourceTypes.includes(r.resourceType)) return false;
    }
    if (filters.openAccessOnly) {
      if (!r.locations.some((l) => l.accessStatus === "open-access")) return false;
    }
    if (filters.providers && filters.providers.length > 0) {
      if (!r.providers.some((p) => filters.providers?.includes(p))) return false;
    }
    return true;
  });
}
