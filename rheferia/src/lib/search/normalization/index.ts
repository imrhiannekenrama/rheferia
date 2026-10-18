/**
 * Text normalization for query planning, deduplication, and matching.
 * Preserves meaning: never strips proper nouns wholesale, never mangles
 * non-English text beyond whitespace/punctuation basics.
 */

/** DOI regex: bare or URL form, case-insensitive. */
const DOI_PATTERN =
  /\b(10\.\d{4,9}\/[^\s"<>]+)\b/i;
const DOI_URL_PATTERN = /(?:https?:\/\/)?(?:dx\.)?doi\.org\/(10\.[^\s"<>]+)/i;

/** Extract a DOI from arbitrary text, normalized to bare lowercase form. */
export function extractDoi(text: string): string | null {
  const urlMatch = text.match(DOI_URL_PATTERN);
  if (urlMatch?.[1]) return normalizeDoi(urlMatch[1]);
  const bare = text.match(DOI_PATTERN);
  if (bare?.[1]) return normalizeDoi(bare[1]);
  return null;
}

/** Normalize a DOI: trim, lowercase, strip doi.org prefix, trailing punctuation. */
export function normalizeDoi(doi: string): string {
  return doi
    .trim()
    .toLowerCase()
    .replace(/^(?:https?:\/\/)?(?:dx\.)?doi\.org\//i, "")
    .replace(/[.,;)]+$/, "");
}

/** Collapse whitespace and trim. */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Conservative title fingerprint for matching/dedup: lowercase, remove
 * punctuation, collapse whitespace. Diacritics and non-English text kept.
 */
export function titleFingerprint(title: string): string {
  return normalizeWhitespace(
    title
      .toLowerCase()
      .replace(/[\p{P}\p{S}]+/gu, " ")
      .replace(/\s+/g, " "),
  );
}

/** First author family name fingerprint, or organization-ish raw name. */
export function firstAuthorFingerprint(authors: readonly { raw: string }[]): string {
  const first = authors[0];
  if (!first) return "";
  return titleFingerprint(first.raw);
}

/**
 * Tokenize into meaningful terms for ranking/matching.
 * Drops common English stopwords and 1-2 character fragments.
 */
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "can",
  "for", "from", "had", "has", "have", "how", "if", "in", "into", "is", "it",
  "its", "may", "of", "on", "or", "our", "over", "so", "such", "than", "that",
  "the", "their", "there", "these", "this", "to", "was", "were", "what",
  "when", "where", "which", "who", "why", "will", "with", "would", "you",
  "your", "using", "use", "used", "among", "between", "about", "study",
  "studies", "research", "effect", "effects", "impact", "impacts", "toward",
  "towards", "does", "do", "did", "not", "no", "nor", "also", "more", "most",
]);

export function tokenize(text: string): string[] {
  const raw = titleFingerprint(text).split(" ");
  return raw.filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/**
 * Conservative title similarity in [0, 1]: Jaccard over tokens.
 * A high value with matching first author + year supports deduplication.
 */
export function titleSimilarity(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection += 1;
  const union = ta.size + tb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Parse a year out of free text, or null. */
export function parseYear(text: string): number | null {
  const m = text.match(/\b(19|20)\d{2}\b/);
  if (!m) return null;
  const y = Number(m[0]);
  return y >= 1900 && y <= 2100 ? y : null;
}

/** Clamp an integer within a range, or return the fallback. */
export function clampInt(value: number | undefined | null, min: number, max: number, fallback: number): number {
  if (value == null || Number.isNaN(value)) return fallback;
  const n = Math.round(value);
  return Math.min(max, Math.max(min, n));
}

/** Format an author list for display: keeps it honest and readable. */
export function formatAuthors(
  authors: readonly { raw: string }[],
  max = 6,
): string {
  if (authors.length === 0) return "Unknown author";
  const names = authors.slice(0, max).map((a) => a.raw);
  const suffix = authors.length > max ? ` … (+${authors.length - max} more)` : "";
  return names.join(", ") + suffix;
}
