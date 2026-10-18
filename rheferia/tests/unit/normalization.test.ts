import { describe, expect, it } from "vitest";
import {
  extractDoi,
  normalizeDoi,
  titleSimilarity,
  tokenize,
  titleFingerprint,
  formatAuthors,
} from "@/lib/search/normalization";

describe("DOI extraction and normalization", () => {
  it("extracts a bare DOI", () => {
    expect(extractDoi("10.1038/nature12373")).toBe("10.1038/nature12373");
  });

  it("extracts a DOI from a URL and strips the prefix", () => {
    expect(extractDoi("https://doi.org/10.1038/nature12373")).toBe(
      "10.1038/nature12373",
    );
    expect(extractDoi("https://dx.doi.org/10.1111/j.1467-8535.2010")).toBe(
      "10.1111/j.1467-8535.2010",
    );
  });

  it("normalizes case and trailing punctuation", () => {
    expect(normalizeDoi("10.1038/NATURE12373.")).toBe("10.1038/nature12373");
  });

  it("returns null for non-DOI text", () => {
    expect(extractDoi("student engagement in mathematics")).toBeNull();
    expect(extractDoi("10.abc/xyz")).toBeNull();
  });

  it("finds a DOI embedded in a longer title", () => {
    expect(extractDoi("See 10.1016/j.scied.2022.103487 for details")).toBe(
      "10.1016/j.scied.2022.103487",
    );
  });
});

describe("title similarity and fingerprinting", () => {
  it("is 1 for identical titles modulo punctuation/case", () => {
    expect(
      titleSimilarity(
        "Offline Classroom Response Systems and Student Engagement",
        "offline classroom response systems and student engagement!",
      ),
    ).toBe(1);
  });

  it("is high for reordered but same-concept titles", () => {
    const sim = titleSimilarity(
      "Student engagement with classroom response systems",
      "Classroom response systems and student engagement",
    );
    expect(sim).toBeGreaterThan(0.6);
  });

  it("is low for unrelated titles", () => {
    const sim = titleSimilarity(
      "Coral reef biodiversity in the Pacific",
      "Classroom response systems and student engagement",
    );
    expect(sim).toBeLessThan(0.15);
  });

  it("fingerprints non-English text without destroying it", () => {
    expect(titleFingerprint("Estudio del Aprendizaje  Español")).toBe(
      "estudio del aprendizaje español",
    );
  });
});

describe("tokenize", () => {
  it("drops stopwords and short fragments", () => {
    const tokens = tokenize(
      "The Effect of Study Habits on the Academic Performance of Students",
    );
    expect(tokens).not.toContain("the");
    expect(tokens).not.toContain("of");
    expect(tokens).not.toContain("on");
  });

  it("keeps meaningful content terms", () => {
    const tokens = tokenize(
      "Classroom response systems improve engagement",
    );
    expect(tokens).toContain("classroom");
    expect(tokens).toContain("response");
    expect(tokens).toContain("improve");
  });
});

describe("formatAuthors", () => {
  it("handles empty, short, and long author lists honestly", () => {
    expect(formatAuthors([])).toBe("Unknown author");
    expect(formatAuthors([{ raw: "Maria Santos" }, { raw: "Jose Rizal" }])).toBe(
      "Maria Santos, Jose Rizal",
    );
    const many = Array.from({ length: 10 }, (_, i) => ({ raw: `Author ${i}` }));
    expect(formatAuthors(many)).toContain("+4 more");
  });
});
