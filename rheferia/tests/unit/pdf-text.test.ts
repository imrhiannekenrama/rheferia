import { describe, expect, it } from "vitest";
import { textToPdf } from "@/lib/conversions/pdf-ops";
import { extractPdfText, pdfTextToOutput } from "@/lib/conversions/pdf-text";

describe("PDF text extraction", () => {
  it("extracts embedded text page by page", async () => {
    const bytes = await textToPdf("Notes", "Page one says formative assessment.\nPage two starts here.");
    const result = await extractPdfText(bytes);
    expect(result.pageCount).toBe(1);
    expect(result.pages[0]!.text).toContain("formative assessment");
    expect(result.emptyPages).toEqual([]);
    expect(pdfTextToOutput(result)).toContain("--- Page 1 ---");
  });

  it("extracts text from every generated page of a long document", async () => {
    const body = Array.from({ length: 120 }, (_, i) => `Paragraph ${i + 1} with distinct content.`).join("\n");
    const bytes = await textToPdf("", body);
    const result = await extractPdfText(bytes);
    expect(result.pageCount).toBeGreaterThan(1);
    expect(result.emptyPages).toEqual([]);
    expect(result.pages[0]!.text).toContain("Paragraph 1");
  });

  it("reports a non-PDF input honestly", async () => {
    await expect(extractPdfText(new Uint8Array([1, 2, 3, 4, 5]))).rejects.toThrow(
      /not a readable PDF/,
    );
  });
});
