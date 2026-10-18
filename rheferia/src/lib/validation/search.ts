/**
 * Zod schemas: search request validation for the API route and the page.
 * Bounded page sizes, enum-validated filters, safe defaults.
 */

import { z } from "zod";

export const resourceTypeEnum = z.enum([
  "journal-article",
  "preprint",
  "book",
  "book-chapter",
  "conference-paper",
  "thesis",
  "report",
  "dataset",
  "webpage",
  "other",
]);

export const providerEnum = z.enum([
  "openalex",
  "crossref",
  "unpaywall",
  "semantic-scholar",
  "brave",
]);

/** Empty year inputs submit as "" - treat blank as "no filter", not 0. */
const yearField = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.coerce
    .number({ message: "Year must be a number" })
    .int("Year must be a whole number")
    .min(1900, "Year must be 1900 or later")
    .max(2100, "Year must be 2100 or earlier")
    .optional(),
);
export const searchRequestSchema = z.object({
  q: z.string().trim().min(1, "Enter something to search for").max(500, "Query is too long"),
  mode: z.enum(["auto", "title-question", "exact-title", "keywords", "advanced"]).default("auto"),
  sort: z.enum(["relevance", "newest", "oldest", "citations"]).default("relevance"),
  yearFrom: yearField,
  yearTo: yearField,
  types: z.string().max(200).optional(), // comma-separated enum values
  providers: z.string().max(200).optional(), // comma-separated enum values
  openAccess: z.enum(["true", "false"]).optional(),
  exactPhrase: z.string().max(300).optional(),
  excluded: z.string().max(300).optional(),
  author: z.string().max(200).optional(),
  cursor: z.string().max(512).optional(),
});

export type ParsedSearchRequest = z.infer<typeof searchRequestSchema>;

/** Convert parsed form fields into a typed SearchRequest. */
export function toSearchRequest(parsed: ParsedSearchRequest) {
  const types = (parsed.types ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => (resourceTypeEnum.options as string[]).includes(t));
  const providers = (parsed.providers ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter((p) => (providerEnum.options as string[]).includes(p));

  let query = parsed.q;
  if (parsed.mode === "advanced" && parsed.exactPhrase) {
    query = parsed.exactPhrase;
  }

  return {
    query,
    mode: parsed.mode,
    filters: {
      yearFrom: parsed.yearFrom,
      yearTo: parsed.yearTo,
      resourceTypes: types.length > 0 ? (types as never) : undefined,
      providers: providers.length > 0 ? (providers as never) : undefined,
      openAccessOnly: parsed.openAccess === "true",
      exactPhrase: parsed.exactPhrase,
      excludedTerms: parsed.excluded,
      author: parsed.author,
    },
    sort: parsed.sort,
    cursor: parsed.cursor,
  };
}
