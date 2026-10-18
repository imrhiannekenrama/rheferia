/**
 * PDF text extraction with pdf.js. Runs in the browser and in Node (tests).
 * Honest per-page reporting: pages without an embedded text layer
 * (scans without OCR) are listed instead of silently coming back empty.
 */

import type { TextItem } from "pdfjs-dist/types/src/display/api";

export interface PdfTextResult {
  /** Extracted text per page, 1-based labels in the output. */
  pages: { page: number; text: string }[];
  /** Pages that produced no text (likely scanned images without OCR). */
  emptyPages: number[];
  pageCount: number;
}

export class PdfTextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfTextError";
  }
}

type PdfjsModule = typeof import("pdfjs-dist");

let modulePromise: Promise<PdfjsModule> | null = null;

async function getPdfjs(): Promise<PdfjsModule> {
  if (!modulePromise) {
    modulePromise = import("pdfjs-dist").then((mod) => {
      // In the browser, pdf.js needs its worker file; we ship it from /public.
      if (typeof window !== "undefined" && mod.GlobalWorkerOptions) {
        mod.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      }
      return mod;
    });
  }
  return modulePromise;
}

export async function extractPdfText(bytes: Uint8Array): Promise<PdfTextResult> {
  const pdfjs = await getPdfjs();
  let doc;
  try {
    doc = await pdfjs.getDocument({
      data: bytes.slice(0), // copy: pdf.js transfers the buffer
      isEvalSupported: false,
      useSystemFonts: false,
    }).promise;
  } catch {
    throw new PdfTextError(
      "This file is not a readable PDF. It may be corrupt or password-protected.",
    );
  }

  const pages: PdfTextResult["pages"] = [];
  const emptyPages: number[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? (item as TextItem).str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length === 0) {
      emptyPages.push(pageNum);
    }
    pages.push({ page: pageNum, text });
  }

  await doc.destroy();
  return { pages, emptyPages, pageCount: doc.numPages };
}

/** Build the .txt file body with page markers. */
export function pdfTextToOutput(result: PdfTextResult): string {
  const lines: string[] = [];
  for (const page of result.pages) {
    lines.push(`--- Page ${page.page} ---`);
    lines.push(page.text.length > 0 ? page.text : "[No embedded text on this page]");
    lines.push("");
  }
  return lines.join("\n");
}
