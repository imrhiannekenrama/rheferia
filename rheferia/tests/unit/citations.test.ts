import { describe, expect, it } from "vitest";
import { formatCitation } from "@/lib/citations/styles";
import { findMissingFields, type CitationData } from "@/lib/citations/types";
import { toBibtex } from "@/lib/citations/bibtex";
import { toRis } from "@/lib/citations/ris";
import { toPlainText } from "@/lib/citations/exporters";

const full: CitationData = {
  recordId: "crossref:10.1038/nature12373",
  authors: [
    { family: "Smith", given: "Jane Marie", raw: "Jane Marie Smith" },
    { family: "Okafor", given: "Chidi", raw: "Chidi Okafor" },
    { family: "Tanaka", given: "Hiro", raw: "Hiro Tanaka" },
  ],
  year: 2013,
  title: "The Effects of Classroom Response Systems on Student Engagement",
  resourceType: "journal-article",
  container: "Journal of Educational Technology",
  publisher: null,
  volume: "12",
  issue: "3",
  pages: "100-120",
  doi: "10.1038/nature12373",
  url: "https://doi.org/10.1038/nature12373",
  edition: null,
};

describe("missing-field flags", () => {
  it("flags nothing when metadata is complete", () => {
    expect(findMissingFields(full)).toEqual([]);
  });

  it("flags missing core fields and skips volume/pages for non-articles", () => {
    const sparse: CitationData = {
      ...full,
      volume: null,
      issue: null,
      pages: null,
      year: null,
      doi: null,
      resourceType: "journal-article",
    };
    expect(findMissingFields(sparse)).toContain("year");
    expect(findMissingFields(sparse)).toContain("volume");
    expect(findMissingFields(sparse)).toContain("pages");
    expect(findMissingFields(sparse)).toContain("doi");
  });

  it("does not demand volume for a book", () => {
    const book: CitationData = { ...full, resourceType: "book", volume: null, pages: null, container: null };
    const missing = findMissingFields(book);
    expect(missing).not.toContain("volume");
    expect(missing).not.toContain("container");
    expect(missing).toContain("publisher");
  });
});

describe("APA 7", () => {
  it("formats a full journal article", () => {
    const out = formatCitation(full, "apa");
    expect(out.reference).toContain("Smith, J. M., Okafor, C., & Tanaka, H. (2013).");
    expect(out.reference).toContain("*Journal of Educational Technology*, *12*(3), 100-120.");
    expect(out.reference).toContain("https://doi.org/10.1038/nature12373");
    expect(out.inText).toBe("(Smith et al., 2013)");
  });

  it("uses n.d. for a missing year, without inventing one", () => {
    const out = formatCitation({ ...full, year: null }, "apa");
    expect(out.reference).toContain("(n.d.)");
    expect(out.inText).toBe("(Smith et al., n.d.)");
  });

  it("two authors get both names in-text", () => {
    const out = formatCitation({ ...full, authors: full.authors.slice(0, 2) }, "apa");
    expect(out.inText).toBe("(Smith & Okafor, 2013)");
  });

  it("handles an organization author", () => {
    const out = formatCitation(
      { ...full, authors: [{ raw: "World Health Organization", isOrganization: true }] },
      "apa",
    );
    expect(out.reference).toContain("World Health Organization (2013).");
    expect(out.inText).toBe("(World Health Organization, 2013)");
  });

  it("sentence-cases a Title Case article title but keeps proper nouns", () => {
    const out = formatCitation(full, "apa");
    expect(out.reference).toContain("The effects of classroom response systems on student engagement");
  });
});

describe("MLA 9", () => {
  it("formats with quoted title and container", () => {
    const out = formatCitation(full, "mla");
    expect(out.reference).toContain('"The Effects of Classroom Response Systems on Student Engagement."');
    expect(out.reference).toContain("*Journal of Educational Technology*, vol. 12, no. 3,");
    expect(out.reference).toContain("pp. 100-120.");
    expect(out.inText).toContain("(Smith 100)");
  });
});

describe("Chicago 17", () => {
  it("formats a journal article with (year): pages", () => {
    const out = formatCitation(full, "chicago");
    expect(out.reference).toContain("Smith, Jane Marie, Chidi Okafor, and Hiro Tanaka.");
    expect(out.reference).toContain("*Journal of Educational Technology*, vol. 12, no. 3 (2013): 100-120.");
    expect(out.inText).toBe("(Smith 2013)");
  });
});

describe("IEEE", () => {
  it("numbers the entry and initials the authors", () => {
    const out = formatCitation(full, "ieee", 4);
    expect(out.reference).toMatch(/^\[4\] J. M. Smith, C. Okafor, H. Tanaka,/);
    expect(out.reference).toContain('*Journal of Educational Technology*, vol. 12, no. 3, pp. 100-120, 2013.');
    expect(out.reference).toContain("doi: 10.1038/nature12373.");
    expect(out.inText).toBe("[4]");
  });
});

describe("Vancouver", () => {
  it("uses surname plus period-free initials and semicolon formatting", () => {
    const out = formatCitation(full, "vancouver", 1);
    expect(out.reference).toMatch(/^\[1\] Smith JM, Okafor C, Tanaka H\./);
    expect(out.reference).toContain("Journal of Educational Technology. 2013;12(3):100-120.");
    expect(out.reference).toContain("doi:10.1038/nature12373.");
  });
});

describe("Vancouver edge cases", () => {
  it("truncates at six authors without a doubled period", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      family: `Author${i}`,
      given: "A",
      raw: `A Author${i}`,
    }));
    const out = formatCitation({ ...full, authors: many }, "vancouver", 1);
    expect(out.reference).toContain("Author5 A, et al.");
    expect(out.reference).not.toContain("et al..");
  });
});

describe("Harvard", () => {
  it("formats with quoted title and vol/issue in parens", () => {
    const out = formatCitation(full, "harvard");
    expect(out.reference).toContain("Smith, J. M., Okafor, C. and Tanaka, H. (2013)");
    expect(out.reference).toContain("'The effects of classroom response systems on student engagement',");
    expect(out.reference).toContain("*Journal of Educational Technology*, vol. 12(3), pp. 100-120.");
    expect(out.inText).toBe("(Smith, 2013)");
  });
});

describe("missing data across styles", () => {
  it("omits absent pieces instead of inventing them, in every style", () => {
    const sparse: CitationData = {
      ...full,
      volume: null,
      issue: null,
      pages: null,
      doi: null,
      url: null,
      authors: [],
      year: null,
      container: null,
    };
    for (const style of ["apa", "mla", "chicago", "ieee", "vancouver", "harvard"] as const) {
      const out = formatCitation(sparse, style);
      expect(out.reference).not.toMatch(/vol\.? \d/);
      expect(out.reference).not.toMatch(/pp\.? \d/);
      expect(out.reference).not.toMatch(/\(\d{4}\)/); // no invented year anywhere
      expect(out.missingFields.length).toBeGreaterThan(3);
    }
  });
});

describe("BibTeX export", () => {
  it("emits a valid entry with escaped characters", () => {
    const bib = toBibtex([{ ...full, title: "A Study of 100% Engagement & Learning" }]);
    expect(bib).toContain("@article{smith2013study,");
    expect(bib).toContain('title = {A Study of 100\\% Engagement \\& Learning},');
    expect(bib).toContain("journal = {Journal of Educational Technology},");
    expect(bib).toContain("pages = {100--120},");
    expect(bib).toContain("doi = {10.1038/nature12373},");
  });

  it("wraps organization authors in braces", () => {
    const bib = toBibtex([
      { ...full, authors: [{ raw: "World Health Organization", isOrganization: true }] },
    ]);
    expect(bib).toContain("author = {{World Health Organization}},");
  });
});

describe("RIS export", () => {
  it("emits standard tags", () => {
    const ris = toRis([full]);
    expect(ris).toContain("TY  - JOUR");
    expect(ris).toContain("AU  - Smith, Jane Marie");
    expect(ris).toContain("TI  - The Effects of Classroom Response Systems on Student Engagement");
    expect(ris).toContain("T2  - Journal of Educational Technology");
    expect(ris).toContain("PY  - 2013");
    expect(ris).toContain("VL  - 12");
    expect(ris).toContain("IS  - 3");
    expect(ris).toContain("SP  - 100");
    expect(ris).toContain("EP  - 120");
    expect(ris).toContain("DO  - 10.1038/nature12373");
    expect(ris.trimEnd().endsWith("ER  -")).toBe(true);
  });

  it("handles single-page records", () => {
    const ris = toRis([{ ...full, pages: "42" }]);
    expect(ris).toContain("SP  - 42");
    expect(ris).toContain("EP  - 42");
  });
});

describe("plain text export", () => {
  it("lists references without markdown emphasis", () => {
    const out = formatCitation(full, "apa");
    const text = toPlainText([out], "apa");
    expect(text).toContain("References (APA 7th edition)");
    expect(text).toContain("Journal of Educational Technology, 12(3), 100-120.");
    expect(text).not.toContain("*");
  });
});
