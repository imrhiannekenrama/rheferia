import { describe, expect, it } from "vitest";
import { rankAndSort, applyFilters } from "@/lib/search/ranking";
import type { ResourceRecord, SearchRequest } from "@/lib/search/types";

function record(overrides: Partial<ResourceRecord>): ResourceRecord {
  return {
    id: "openalex:test",
    title: "Record",
    authors: [],
    year: 2020,
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

const baseRequest: SearchRequest = {
  query: "classroom response systems student engagement mathematics",
  mode: "title-question",
  filters: {},
  sort: "relevance",
};

describe("ranking", () => {
  it("ranks a strong topical match above an unrelated record", () => {
    const strong = record({
      id: "openalex:s1",
      title: "Classroom response systems and student engagement in mathematics",
      abstract: "We study response systems and student engagement in secondary mathematics.",
    });
    const weak = record({
      id: "openalex:w1",
      title: "Coral reef biodiversity patterns",
      abstract: "Corals and fish diversity in the Pacific ocean.",
    });

    const ranked = rankAndSort([weak, strong], baseRequest);
    expect(ranked[0]!.id).toBe("openalex:s1");
    expect(ranked[0]!.match!.matchedTerms).toContain("classroom");
    expect(ranked[0]!.match!.score).toBeGreaterThan(ranked[1]!.match!.score);
  });

  it("labels an exact title match as exact", () => {
    const exact = record({ id: "openalex:e1", title: "Crowdsourced grading in higher education" });
    const ranked = rankAndSort(
      [exact],
      { ...baseRequest, query: "Crowdsourced grading in higher education" },
    );
    expect(ranked[0]!.match!.label).toBe("exact-match");
  });

  it("sorts newest first while missing years sort last", () => {
    const a = record({ id: "a", title: "About topic", year: 2015 });
    const b = record({ id: "b", title: "About topic", year: 2024 });
    const c = record({ id: "c", title: "About topic", year: null });
    const ranked = rankAndSort([a, b, c], { ...baseRequest, sort: "newest" });
    expect(ranked.map((r) => r.id)).toEqual(["b", "a", "c"]);
  });

  it("treats missing citation counts as distinct from zero (null sorts last)", () => {
    const zero = record({ id: "z", title: "About topic", citationCount: 0 });
    const many = record({ id: "m", title: "About topic", citationCount: 99 });
    const none = record({ id: "n", title: "About topic", citationCount: null });
    const ranked = rankAndSort([zero, none, many], { ...baseRequest, sort: "citations" });
    expect(ranked.map((r) => r.id)).toEqual(["m", "z", "n"]);
  });

  it("is stable across identical inputs (pagination safety)", () => {
    const recs = Array.from({ length: 20 }, (_, i) =>
      record({ id: `r${i}`, title: `Topic number ${i} about engagement` }),
    );
    const first = rankAndSort(recs, baseRequest).map((r) => r.id);
    const second = rankAndSort([...recs].reverse(), baseRequest).map((r) => r.id);
    expect(first).toEqual(second);
  });
});

describe("filters", () => {
  it("applies year range and open-access filters", () => {
    const old = record({ id: "old", title: "About topic", year: 1999 });
    const fresh = record({
      id: "fresh",
      title: "About topic",
      year: 2024,
      locations: [
        { url: "https://example.org/a.pdf", label: "OA PDF", accessStatus: "open-access", source: "openalex", retrievedAt: "2026-10-17T00:00:00Z" },
      ],
    });
    const filtered = applyFilters([old, fresh], {
      ...baseRequest,
      filters: { yearFrom: 2020, openAccessOnly: true },
    });
    expect(filtered.map((r) => r.id)).toEqual(["fresh"]);
  });
});
