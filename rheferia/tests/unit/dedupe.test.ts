import { describe, expect, it } from "vitest";
import { dedupeRecords, sameResourceConservative } from "@/lib/search/dedupe";
import type { ResourceRecord } from "@/lib/search/types";

function record(overrides: Partial<ResourceRecord>): ResourceRecord {
  return {
    id: "openalex:test",
    title: "Test record",
    authors: [{ raw: "A. Researcher" }],
    year: 2023,
    publishedDate: null,
    resourceType: "journal-article",
    venue: null,
    publisher: null,
    volume: null,
    issue: null,
    pages: null,
    language: null,
    doi: null,
    identifiers: [],
    abstract: null,
    abstractKind: null,
    locations: [],
    citationCount: null,
    isRetracted: null,
    providers: ["openalex"],
    retrievedAt: "2026-10-17T00:00:00Z",
    ...overrides,
  };
}

describe("deduplication", () => {
  it("collapses the same DOI from two providers and unions provenance", () => {
    const a = record({
      id: "openalex:W1",
      title: "Study habits and academic performance",
      doi: "10.1000/test",
      providers: ["openalex"],
      abstract: "An abstract from OpenAlex.",
    });
    const b = record({
      id: "crossref:10.1000/test",
      title: "Study habits and academic performance",
      doi: "10.1000/test",
      providers: ["crossref"],
      citationCount: 12,
      identifiers: [{ provider: "crossref", id: "10.1000/test" }],
    });

    const result = dedupeRecords([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0]!.providers).toEqual(expect.arrayContaining(["openalex", "crossref"]));
    expect(result[0]!.citationCount).toBe(12);
    expect(result[0]!.abstract).toBe("An abstract from OpenAlex.");
  });

  it("keeps different DOIs separate even with similar titles", () => {
    const a = record({ id: "openalex:W1", title: "Student engagement in classrooms", doi: "10.1/a" });
    const b = record({ id: "openalex:W2", title: "Student engagement in classrooms", doi: "10.1/b" });
    expect(dedupeRecords([a, b])).toHaveLength(2);
  });

  it("conservatively matches a crossref record without a DOI to an OpenAlex twin", () => {
    const a = record({
      id: "openalex:W9",
      title: "Classroom response systems and student engagement in mathematics",
      authors: [{ raw: "Maria Santos" }],
      year: 2021,
    });
    const b = record({
      id: "crossref:no-doi",
      title: "Classroom response systems and student engagement in mathematics",
      authors: [{ raw: "Santos, Maria" }],
      year: 2021,
      providers: ["crossref"],
      identifiers: [{ provider: "crossref", id: "unknown" }],
    });
    expect(dedupeRecords([a, b])).toHaveLength(1);
  });

  it("does not collapse a preprint and published version with different years", () => {
    const preprint = record({
      id: "openalex:P1",
      title: "Effects of offline response systems on engagement",
      year: 2020,
    });
    const published = record({
      id: "openalex:P2",
      title: "Effects of offline response systems on engagement",
      year: 2022,
    });
    expect(dedupeRecords([preprint, published])).toHaveLength(2);
  });

  it("sameResourceConservative requires author agreement when both have authors", () => {
    const a = record({ title: "Identical titles about engagement", authors: [{ raw: "Maria Santos" }] });
    const b = record({ title: "Identical titles about engagement", authors: [{ raw: "John Cruz" }] });
    expect(sameResourceConservative(a, b)).toBe(false);
  });
});
