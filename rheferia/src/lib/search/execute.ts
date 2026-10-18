/**
 * Search orchestration: concurrent provider fan-out with a bounded request
 * budget, per-provider timeouts, partial results on failure, honest
 * provider statuses, then dedupe → rank → filter → cursor pagination.
 *
 * Pagination uses a bounded merged snapshot + opaque offset cursor
 * (never summed provider totals presented as unique results).
 */

import { planQuery } from "@/lib/search/query-planning";
import { dedupeRecords } from "@/lib/search/dedupe";
import { applyFilters, rankAndSort } from "@/lib/search/ranking";
import {
  errorToStatus,
  ProviderFetchError,
} from "@/lib/search/providers/base";
import {
  getOpenAlexByDoi,
  searchOpenAlex,
} from "@/lib/search/providers/openalex";
import {
  getCrossrefByDoi,
  searchCrossref,
} from "@/lib/search/providers/crossref";
import { enrichWithUnpaywall } from "@/lib/search/providers/unpaywall";
import { searchBrave } from "@/lib/search/providers/brave";
import { searchSemanticScholar } from "@/lib/search/providers/semantic-scholar";
import type {
  ProviderId,
  ProviderStatus,
  ResourceRecord,
  SearchRequest,
  SearchResponse,
} from "@/lib/search/types";
import { searchProviderConfig } from "@/lib/config/env";

const PAGE_SIZE_DEFAULT = 20;
const MAX_PAGE_SIZE = 50;
/** Total records fetched per search across all queries/providers. */
const SNAPSHOT_LIMIT = 120;

/** Opaque cursor: base64url({offset, hash}) — tamper-evident, not secret. */
function encodeCursor(offset: number, requestHash: string): string {
  return Buffer.from(
    JSON.stringify({ o: offset, h: requestHash }),
    "utf8",
  ).toString("base64url");
}

function decodeCursor(cursor: string): { offset: number; hash: string } | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as { o?: number; h?: string };
    if (typeof parsed.o !== "number" || typeof parsed.h !== "string") return null;
    if (parsed.o < 0 || parsed.o > 10_000) return null;
    return { offset: parsed.o, hash: parsed.h };
  } catch {
    return null;
  }
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function executeSearch(request: SearchRequest): Promise<SearchResponse> {
  const config = searchProviderConfig();
  const plan = planQuery(request);
  const pageSize = Math.min(request.pageSize ?? PAGE_SIZE_DEFAULT, MAX_PAGE_SIZE);
  const budget = Math.min(
    config.maxRequestsPerSearch,
    12,
  );

  const statuses: ProviderStatus[] = [];
  const records: ResourceRecord[] = [];
  let requestsUsed = 0;

  /* --------------------------- DOI direct resolution --------------------------- */
  if (plan.detectedDoi && requestsUsed < budget) {
    requestsUsed += 2;
    const [crossrefRes, openalexRes] = await Promise.allSettled([
      getCrossrefByDoi({ contactEmail: config.crossrefContactEmail }, plan.detectedDoi),
      getOpenAlexByDoi({ apiKey: config.openalexApiKey, contactEmail: config.crossrefContactEmail }, plan.detectedDoi),
    ]);
    for (const res of [crossrefRes, openalexRes]) {
      if (res.status === "fulfilled") {
        records.push(res.value);
        statuses.push({
          provider: res.value.providers[0] ?? "crossref",
          state: "ok",
          resultCount: 1,
        });
      }
    }
    if (crossrefRes.status === "rejected") {
      statuses.push({
        provider: "crossref",
        ...errorToStatus("crossref", crossrefRes.reason),
      });
    }
    if (openalexRes.status === "rejected") {
      statuses.push({
        provider: "openalex",
        ...errorToStatus("openalex", openalexRes.reason),
      });
    }
    // Optional OA enrichment for the resolved record.
    if (config.unpaywallEmail && records[0]?.doi) {
      const [first] = records;
      if (first) {
        records[0] = await enrichWithUnpaywall(
          { email: config.unpaywallEmail },
          first,
        );
        statuses.push({
          provider: "unpaywall",
          state: "ok",
          resultCount: 1,
        });
      }
    }
    return finalize(records, statuses, plan, request, pageSize);
  }

  /* ------------------------------ keyword / title ------------------------------ */
  const providerFilter = request.filters.providers;
  const wants = (p: ProviderId) =>
    !providerFilter || providerFilter.length === 0 || providerFilter.includes(p);

  const tasks: Array<Promise<void>> = [];
  const push = (p: Promise<unknown>) => tasks.push(p.then(() => undefined));
  const scholarlyQueries = plan.queries.slice(0, 2); // bounded: ≤2 queries/core provider

  if (wants("openalex")) {
    for (const q of scholarlyQueries) {
      if (requestsUsed >= budget) break;
      requestsUsed += 1;
      push(
        searchOpenAlex(
          {
            apiKey: config.openalexApiKey,
            contactEmail: config.crossrefContactEmail,
          },
          { query: q, perPage: 25, filters: request.filters },
        )
          .then((recs) => {
            records.push(...recs);
            statuses.push({ provider: "openalex", state: "ok", resultCount: recs.length });
          })
          .catch((err) =>
            statuses.push({ provider: "openalex", ...errorToStatus("openalex", err) }),
          ),
      );
    }
  }

  if (wants("crossref")) {
    for (const q of scholarlyQueries) {
      if (requestsUsed >= budget) break;
      requestsUsed += 1;
      push(
        searchCrossref(
          { contactEmail: config.crossrefContactEmail },
          { query: q, rows: 20, filters: request.filters },
        )
          .then((recs) => {
            records.push(...recs);
            statuses.push({ provider: "crossref", state: "ok", resultCount: recs.length });
          })
          .catch((err) =>
            statuses.push({ provider: "crossref", ...errorToStatus("crossref", err) }),
          ),
      );
    }
  }

  if (wants("semantic-scholar") && config.semanticScholarApiKey) {
    if (requestsUsed < budget) {
      requestsUsed += 1;
      push(
        searchSemanticScholar(
          { apiKey: config.semanticScholarApiKey },
          { query: plan.queries[0] ?? request.query, limit: 15 },
        )
          .then((recs) => {
            records.push(...recs);
            statuses.push({
              provider: "semantic-scholar",
              state: "ok",
              resultCount: recs.length,
            });
          })
          .catch((err) =>
            statuses.push({
              provider: "semantic-scholar",
              ...errorToStatus("semantic-scholar", err),
            }),
          ),
      );
    }
  } else if (wants("semantic-scholar")) {
    statuses.push({
      provider: "semantic-scholar",
      state: "not-configured",
      message: "Add a Semantic Scholar API key to include this source",
    });
  }

  if (wants("brave")) {
    if (config.braveApiKey && requestsUsed < budget) {
      requestsUsed += 1;
      push(
        searchBrave(
          { subscriptionKey: config.braveApiKey },
          { query: request.query, count: 10 },
        )
          .then((recs) => {
            records.push(...recs);
            statuses.push({ provider: "brave", state: "ok", resultCount: recs.length });
          })
          .catch((err) =>
            statuses.push({ provider: "brave", ...errorToStatus("brave", err) }),
          ),
      );
    } else if (!config.braveApiKey) {
      statuses.push({
        provider: "brave",
        state: "not-configured",
        message: "Web results unavailable; add a Brave Search key for reports, theses, and web pages",
      });
    }
  }

  if (config.unpaywallEmail) {
    statuses.push({
      provider: "unpaywall",
      state: "ok",
      message: "Open-access enrichment enabled for DOI lookups",
    });
  } else {
    statuses.push({
      provider: "unpaywall",
      state: "not-configured",
      message: "Add a contact email to resolve open-access copies",
    });
  }

  await Promise.all(tasks);

  // Enrich a bounded set of DOI records with Unpaywall OA evidence.
  if (config.unpaywallEmail) {
    const toEnrich = records
      .filter((r) => r.doi)
      .slice(0, 3); // bounded: keep the request budget honest
    for (let i = 0; i < records.length && toEnrich.length > 0; i++) {
      const rec = records[i];
      if (rec?.doi && toEnrich.includes(rec)) {
        records[i] = await enrichWithUnpaywall({ email: config.unpaywallEmail }, rec);
      }
    }
  }

  return finalize(records, statuses, plan, request, pageSize);
}

/* --------------------------------- finalization -------------------------------- */

async function finalize(
  records: ResourceRecord[],
  statuses: ProviderStatus[],
  plan: ReturnType<typeof planQuery>,
  request: SearchRequest,
  pageSize: number,
): Promise<SearchResponse> {
  const deduped = dedupeRecords(records.slice(0, SNAPSHOT_LIMIT));
  const ranked = rankAndSort(deduped, request);
  const filtered = applyFilters(ranked, request);

  const requestHash = await sha256Hex(
    JSON.stringify({
      q: request.query,
      m: request.mode,
      f: request.filters,
      s: request.sort,
    }),
  );

  // Cursor validation: a cursor from a different request restarts at 0.
  let offset = 0;
  if (request.cursor) {
    const decoded = decodeCursor(request.cursor);
    if (decoded && decoded.hash === requestHash) offset = decoded.offset;
  }

  const page = filtered.slice(offset, offset + pageSize);
  const hasMore = offset + pageSize < filtered.length;
  const nextCursor = hasMore
    ? encodeCursor(offset + pageSize, requestHash)
    : null;

  const okProviders = statuses.filter((s) => s.state === "ok").map((s) => s.provider);
  const coverageNote = buildCoverageNote(statuses, okProviders);

  return {
    results: page,
    nextCursor,
    providerStatuses: statuses,
    queryPlan: plan,
    coverageNote,
  };
}

function buildCoverageNote(
  statuses: ProviderStatus[],
  okProviders: ProviderId[],
): string {
  if (okProviders.length === 0) {
    const anyLimited = statuses.some(
      (s) => s.state === "rate-limited" || s.state === "timed-out",
    );
    return anyLimited
      ? "No sources responded in time. Try again in a moment."
      : "No sources are currently available for this search.";
  }
  const names: Record<ProviderId, string> = {
    openalex: "OpenAlex",
    crossref: "Crossref",
    unpaywall: "Unpaywall",
    "semantic-scholar": "Semantic Scholar",
    brave: "web search",
  };
  const listed = okProviders
    .filter((p) => p !== "unpaywall")
    .map((p) => names[p])
    .join(" and ");
  return `Results from ${listed}. Rheferia searches configured sources; it does not index the entire internet.`;
}

export { ProviderFetchError };
