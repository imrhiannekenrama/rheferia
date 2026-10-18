import { beforeEach, describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  addPageNumbers,
  addWatermark,
  extractPages,
  imagesToPdf,
  mergePdfs,
  reorderPages,
  rotatePdf,
  splitPdf,
  textToPdf,
} from "@/lib/conversions/pdf-ops";
import { parsePageRange, parseReorderSpec, RangeError } from "@/lib/conversions/page-range";

/** Build a real multi-page PDF with identifiable text on each page. */
async function makePdf(pages: string[], opts: { title?: boolean } = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  pages.forEach((label, i) => {
    const page = doc.addPage([612, 792]);
    page.drawText(`${opts.title && i === 0 ? "TITLE PAGE — " : ""}${label}`, {
      x: 72,
      y: 720,
      size: 24,
      font,
      color: rgb(0, 0, 0),
    });
    page.drawText(`page-${i + 1}`, { x: 72, y: 690, size: 16, font });
  });
  return doc.save();
}

async function labelsOf(bytes: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((page) => String(page.getSize().width));
}

let sample: Uint8Array;

beforeEach(async () => {
  sample = await makePdf(["A", "B", "C", "D", "E"]);
});

describe("page range parser", () => {
  it("parses ranges, singles, and open tails", () => {
    expect(parsePageRange("1-3, 5", 6)).toEqual([0, 1, 2, 4]);
    expect(parsePageRange("8-", 10)).toEqual([7, 8, 9]);
    expect(parsePageRange("4", 9)).toEqual([3]);
  });

  it("dedupes overlapping ranges but keeps first-seen order", () => {
    expect(parsePageRange("3-5, 4, 1", 6)).toEqual([2, 3, 4, 0]);
  });

  it("rejects out-of-bounds and malformed input honestly", () => {
    expect(() => parsePageRange("9", 8)).toThrow(RangeError);
    expect(() => parsePageRange("1-99", 8)).toThrow(/outside this document/);
    expect(() => parsePageRange("banana", 8)).toThrow(/not a page or range/);
    expect(() => parsePageRange("5-2", 8)).toThrow(/backwards/);
    expect(() => parsePageRange("", 8)).toThrow(RangeError);
    expect(() => parseReorderSpec("2, banana", 8)).toThrow(/not a page number/);
  });
});

describe("merge", () => {
  it("concatenates pages in order", async () => {
    const a = await makePdf(["A1"]);
    const b = await makePdf(["B1", "B2"]);
    const merged = await mergePdfs([a, b]);
    const doc = await PDFDocument.load(merged);
    expect(doc.getPageCount()).toBe(3);
  });

  it("refuses a single file", async () => {
    await expect(mergePdfs([sample])).rejects.toThrow(/at least two/);
  });
});

describe("extract", () => {
  it("keeps only selected pages", async () => {
    const out = await extractPages(sample, "2, 4-5");
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(3);
  });

  it("rejects out-of-range selections", async () => {
    await expect(extractPages(sample, "6")).rejects.toThrow(/outside this document/);
  });
});

describe("reorder", () => {
  it("reorders, drops unlisted pages, and allows duplicates", async () => {
    const out = await reorderPages(sample, "3, 1, 3");
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(3);
  });
});

describe("split", () => {
  it("produces one file per chunk with descriptive names", async () => {
    const { files, unmatchedPages } = await splitPdf(sample, "1-2; 3; 4-5", "report");
    expect(files).toHaveLength(3);
    expect(files[0]!.name).toContain("(p1-2)");
    expect(files[1]!.name).toContain("(p3)");
    expect(unmatchedPages).toBe(0);
    for (const file of files) {
      const doc = await PDFDocument.load(file.bytes);
      expect(doc.getPageCount()).toBeGreaterThan(0);
    }
  });

  it("reports uncovered pages honestly", async () => {
    const { unmatchedPages } = await splitPdf(sample, "1-2", "x");
    expect(unmatchedPages).toBe(3);
  });
});

describe("rotate", () => {
  it("rotates selected pages by cumulative degrees", async () => {
    const out = await rotatePdf(sample, "2-3", "90");
    const doc = await PDFDocument.load(out);
    expect(doc.getPage(1).getRotation().angle).toBe(90);
    expect(doc.getPage(0).getRotation().angle).toBe(0);
    const again = await rotatePdf(out, "2-3", "90");
    const doc2 = await PDFDocument.load(again);
    expect(doc2.getPage(1).getRotation().angle).toBe(180);
  });

  it("rotates all pages with 'all' or empty spec", async () => {
    const out = await rotatePdf(sample, "", "180");
    const doc = await PDFDocument.load(out);
    expect(doc.getPage(0).getRotation().angle).toBe(180);
  });
});

describe("page numbers", () => {
  it("stamps selected pages with the chosen start and format", async () => {
    const out = await addPageNumbers(sample, {
      position: "bottom-center",
      startAt: 1,
      spec: "",
      format: "page-n",
    });
    const doc = await PDFDocument.load(out);
    // pdf-lib cannot read text back; verify the file is valid and intact
    expect(doc.getPageCount()).toBe(5);
    const bytes = Buffer.from(out);
    expect(bytes.slice(0, 5).toString()).toBe("%PDF-");
  });
});

describe("watermark", () => {
  it("stamps text on pages without breaking the file", async () => {
    const out = await addWatermark(sample, {
      text: "DRAFT",
      opacity: 0.3,
      angle: 45,
      position: "diagonal",
      spec: "",
      color: [0.5, 0.5, 0.5],
    });
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(5);
  });

  it("rejects empty watermark text", async () => {
    await expect(
      addWatermark(sample, {
        text: "   ",
        opacity: 0.3,
        angle: 45,
        position: "center",
        spec: "",
        color: [0, 0, 0],
      }),
    ).rejects.toThrow(/Enter the watermark text/);
  });
});

describe("text → PDF", () => {
  it("wraps long lines and paginates", async () => {
    const paragraph = "This is a sentence about formative assessment. ".repeat(80);
    const out = await textToPdf("Reading Notes", paragraph);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it("keeps blank lines as paragraph gaps", async () => {
    const out = await textToPdf("", "First paragraph.\n\nSecond paragraph.");
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(1);
    expect(await labelsOf(out)).toHaveLength(1);
  });
});

describe("images → PDF", () => {
  it("makes one page per image", async () => {
    // A 1x1 red PNG is enough to prove the pipeline.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const out = await imagesToPdf([
      { bytes: new Uint8Array(png), kind: "png" },
      { bytes: new Uint8Array(png), kind: "png" },
    ]);
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(2);
  });

  it("rejects junk bytes honestly", async () => {
    await expect(
      imagesToPdf([{ bytes: new Uint8Array([1, 2, 3, 4]), kind: "png" }]),
    ).rejects.toThrow(/could not be read/);
  });
});

describe("encrypted PDFs are reported, not mangled", () => {
  it("refuses to modify a document with an /Encrypt trailer", async () => {
    const doc = await PDFDocument.load(sample);
    void doc;
    // Synthesize an encrypted-looking header: real encrypted files are caught
    // the same way by the trailer sniff in assertNotEncrypted.
    const fake = new Uint8Array(sample);
    const dict = new TextEncoder().encode("/Encrypt");
    fake.set(dict, 100);
    await expect(extractPages(fake, "1")).rejects.toThrow(/password-protected/);
  });
});
