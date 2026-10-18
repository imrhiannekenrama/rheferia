import { describe, expect, it } from "vitest";
import { formatCitation } from "@/lib/citations/styles";
import type { CitationData } from "@/lib/citations/types";
import { toDocx, toPdf, toPlainText } from "@/lib/citations/exporters";

const sample: CitationData = {
  recordId: "crossref:10.1038/nature12373",
  authors: [
    { family: "Smith", given: "Jane Marie", raw: "Jane Marie Smith" },
    { family: "Okafor", given: "Chidi", raw: "Chidi Okafor" },
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

describe("file exporters", () => {
  it("generates a real Word document (ZIP magic bytes + document.xml)", async () => {
    const formatted = [formatCitation(sample, "apa")];
    const bytes = await toDocx(formatted, "apa");
    const zip = Buffer.from(bytes);
    // .docx is a ZIP: starts with "PK\x03\x04"
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    expect(zip.length).toBeGreaterThan(4000); // a real document, not a stub
  });

  it("generates a real PDF with correct header", async () => {
    const formatted = [formatCitation(sample, "apa"), formatCitation(sample, "vancouver", 2)];
    const bytes = await toPdf(formatted, "vancouver");
    const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
    const tail = Buffer.from(bytes.slice(-512)).toString("latin1");
    expect(tail).toContain("%%EOF");
  });

  it("plain text export strips emphasis markers", () => {
    const formatted = [formatCitation(sample, "apa")];
    const text = toPlainText(formatted, "apa");
    expect(text).not.toContain("*");
    expect(text).toContain("100-120.");
  });
});
