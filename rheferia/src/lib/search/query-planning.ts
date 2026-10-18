/**
 * Deterministic query planning. Translates a user's raw input into a small,
 * bounded set of provider-ready queries. No LLM required for the core path.
 *
 * The illustrative input from the design brief:
 *   "Offline Classroom Response Systems and Student Engagement in Grade 10
 *    Mathematics" should surface concepts such as classroom response
 *    systems, student engagement, secondary mathematics, and offline
 *    learning technology — with editable keyword chips so the user can
 *    correct the interpretation.
 */

import {
  extractDoi,
  normalizeWhitespace,
  tokenize,
  parseYear,
} from "@/lib/search/normalization";
import type { QueryPlan, SearchMode, SearchRequest } from "@/lib/search/types";

/** Meaningful multi-word phrases to try as phrase queries. */
const CONCEPT_HINTS: Array<[RegExp, string]> = [
  [/\bclassroom response systems?\b/i, "classroom response systems"],
  [/\bstudent engagement\b/i, "student engagement"],
  [/\boffline (?:learning|classroom|technology)\b/i, "offline learning technology"],
  [/\baction research\b/i, "action research"],
  [/\b(?:grade|year)\s*\d+\b/i, "secondary education"],
  [/\b(?:mathematics|math)\b/i, "mathematics education"],
  [/\b(?:junior|senior) high school\b/i, "secondary education"],
  [/\bremote learning\b/i, "remote learning"],
  [/\be-?learning\b/i, "e-learning"],
  [/\bblended learning\b/i, "blended learning"],
  [/\breading comprehension\b/i, "reading comprehension"],
  [/\bcritical thinking\b/i, "critical thinking"],
  [/\bacademic performance\b/i, "academic performance"],
  [/\b(?:k-?12|k to 12)\b/i, "K-12 education"],
  [/\bmodular distance learning\b/i, "modular distance learning"],
];

/**
 * Plan a bounded query set from the request. `mode: "auto"` detects a DOI
 * first, then decides between exact-title and title-question behavior by
 * input length and phrasing.
 */
export function planQuery(request: Pick<SearchRequest, "query" | "mode">): QueryPlan {
  const raw = normalizeWhitespace(request.query).slice(0, 500);
  const detectedDoi = extractDoi(raw);

  let mode: SearchMode = request.mode;
  if (mode === "auto") {
    if (detectedDoi) mode = "doi";
    else if (looksLikeExistingTitle(raw)) mode = "exact-title";
    else mode = "title-question";
  }

  const plan: QueryPlan = {
    mode,
    detectedDoi,
    keywords: [],
    queries: [],
    broadened: false,
  };

  if (mode === "doi") {
    plan.queries = [detectedDoi ?? raw];
    return plan;
  }

  // Exact-title: one phrase query, plus the raw text as backup.
  if (mode === "exact-title") {
    plan.queries = dedupeQueries([raw]);
    plan.keywords = tokenize(raw).slice(0, 8);
    return plan;
  }

  // Title-question / keywords: concept extraction.
  const tokens = tokenize(raw);
  const concepts: string[] = [];
  for (const [pattern, phrase] of CONCEPT_HINTS) {
    if (pattern.test(raw)) concepts.push(phrase);
  }
  // Top content terms not already covered by a concept phrase.
  const conceptTokens = new Set(concepts.join(" ").split(" "));
  const extra = tokens
    .filter((t) => !conceptTokens.has(t))
    .slice(0, 6);

  plan.keywords = [...concepts, ...extra].slice(0, 10);

  const queries: string[] = [];
  if (raw.length > 0) queries.push(raw); // the full title/question first
  const conceptQuery = concepts.join(" ");
  if (concepts.length >= 2) queries.push(conceptQuery);
  const fallback = plan.keywords.slice(0, 5).join(" ");
  if (fallback && fallback !== conceptQuery) {
    queries.push(fallback);
    plan.broadened = true;
  }

  plan.queries = dedupeQueries(queries).slice(0, 3); // bounded set
  return plan;
}

/** Heuristic: short, noun-phrase-like, no question mark → maybe a real title. */
function looksLikeExistingTitle(text: string): boolean {
  const hasQuestion = /\?\s*$/.test(text) || /^(what|why|how|is|are|does|do|can|should|to what)\b/i.test(text);
  const wordCount = text.split(" ").filter(Boolean).length;
  return !hasQuestion && wordCount <= 12;
}

function dedupeQueries(queries: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of queries) {
    const key = q.toLowerCase().replace(/\s+/g, " ").trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(q);
    }
  }
  return out;
}

/** Filter out a year that is part of the query from concept matching noise. */
export function stripQueryYear(text: string): string {
  const y = parseYear(text);
  if (!y) return text;
  return text.replace(String(y), " ").replace(/\s+/g, " ").trim();
}
