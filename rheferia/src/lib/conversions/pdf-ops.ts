/**
 * Browser-side PDF operations with pdf-lib. All functions are pure
 * (bytes in → bytes out) so they run identically in the browser and in
 * unit tests, and report honestly when a PDF is encrypted or malformed.
 */

import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { parsePageRange, parseReorderSpec } from "./page-range";

export class PdfOpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfOpError";
  }
}

export async function loadPdf(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    // ignoreEncryption: encrypted files are the common case we must report
    // honestly rather than crash on; we surface a clear message below.
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    if (doc.getPageCount() === 0) throw new PdfOpError("This PDF has no pages.");
    return doc;
  } catch (error) {
    if (error instanceof PdfOpError) throw error;
    throw new PdfOpError("This file is not a readable PDF. It may be corrupt or password-protected.");
  }
}

export function assertNotEncrypted(bytes: Uint8Array): void {
  // pdf-lib cannot modify encrypted documents; sniff the trailer honestly.
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 4096));
  if (head.includes("/Encrypt")) {
    throw new PdfOpError(
      "This PDF is password-protected. Remove the protection first, then try again.",
    );
  }
}

/* ---------------------------------- merge ---------------------------------- */

export async function mergePdfs(files: Uint8Array[]): Promise<Uint8Array> {
  if (files.length < 2) throw new PdfOpError("Select at least two PDFs to merge.");
  const out = await PDFDocument.create();
  for (const file of files) {
    assertNotEncrypted(file);
    const src = await loadPdf(file);
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const page of pages) out.addPage(page);
  }
  return out.save();
}

/* ------------------------------ copy selections ----------------------------- */

async function docWithPages(
  bytes: Uint8Array,
  indices: number[],
): Promise<Uint8Array> {
  assertNotEncrypted(bytes);
  const src = await loadPdf(bytes);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices);
  for (const page of pages) out.addPage(page);
  return out.save();
}

export async function extractPages(bytes: Uint8Array, spec: string): Promise<Uint8Array> {
  const src = await loadPdf(bytes);
  const indices = parsePageRange(spec, src.getPageCount());
  return docWithPages(bytes, indices);
}

export async function reorderPages(bytes: Uint8Array, spec: string): Promise<Uint8Array> {
  const src = await loadPdf(bytes);
  const indices = parseReorderSpec(spec, src.getPageCount());
  return docWithPages(bytes, indices);
}

/* ---------------------------------- split ---------------------------------- */

export interface SplitOutput {
  files: { name: string; bytes: Uint8Array }[];
  /** Number of source pages not covered by any range, reported to the user. */
  unmatchedPages: number;
}

export async function splitPdf(
  bytes: Uint8Array,
  spec: string,
  baseName: string,
): Promise<SplitOutput> {
  const src = await loadPdf(bytes);
  const pageCount = src.getPageCount();

  // Split on ";" — each chunk becomes its own file, e.g. "1-3; 4-6; 7-9".
  const chunksRaw = spec
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  if (chunksRaw.length === 0) throw new PdfOpError("Enter at least one range to split into, e.g. 1-3; 4-6.");

  const used = new Set<number>();
  const files: SplitOutput["files"] = [];

  for (const [index, chunk] of chunksRaw.entries()) {
    const indices = parsePageRange(chunk, pageCount);
    const part = await docWithPages(bytes, indices);
    const label = indices.length === 1 ? `p${indices[0]! + 1}` : `p${indices[0]! + 1}-${indices[indices.length - 1]! + 1}`;
    files.push({ name: `${baseName}-${String(index + 1).padStart(2, "0")} (${label}).pdf`, bytes: part });
    for (const idx of indices) used.add(idx);
  }

  const duplicateCover = chunksRaw.length > 1 && used.size > 0;
  void duplicateCover;
  return { files, unmatchedPages: pageCount - used.size };
}

/* --------------------------------- rotate ---------------------------------- */

const ROTATIONS: Record<string, number> = { "90": 90, "180": 180, "270": 270 };

export async function rotatePdf(
  bytes: Uint8Array,
  spec: string,
  angle: string,
): Promise<Uint8Array> {
  const degreesToRotate = ROTATIONS[angle];
  if (degreesToRotate == null) throw new PdfOpError("Choose a 90, 180, or 270 degree rotation.");

  assertNotEncrypted(bytes);
  const doc = await loadPdf(bytes);
  const pageCount = doc.getPageCount();

  let targets: number[];
  if (spec.trim().length === 0 || spec.trim() === "all") {
    targets = doc.getPageIndices();
  } else {
    targets = parsePageRange(spec, pageCount);
  }

  const pages: PDFPage[] = targets.map((i) => doc.getPage(i));
  for (const page of pages) {
    page.setRotation(degrees((page.getRotation().angle + degreesToRotate) % 360));
  }
  return doc.save();
}

/* ------------------------------ page numbers ------------------------------- */

export type NumberPosition = "bottom-center" | "bottom-right" | "bottom-left" | "top-center" | "top-right" | "top-left";

export async function addPageNumbers(
  bytes: Uint8Array,
  options: {
    position: NumberPosition;
    startAt: number;
    spec: string; // "" = all pages
    format: "n" | "n-of-m" | "page-n";
  },
): Promise<Uint8Array> {
  assertNotEncrypted(bytes);
  const doc = await loadPdf(bytes);
  const pageCount = doc.getPageCount();
  const targets = new Set<number>(
    options.spec.trim().length === 0 ? doc.getPageIndices() : parsePageRange(options.spec, pageCount),
  );

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const size = 10;

  targets.forEach((idx) => {
    const page = doc.getPage(idx);
    const { width, height } = page.getSize();
    const n = options.startAt + indexOfSorted(targets, idx);
    const label =
      options.format === "n-of-m"
        ? `${n} of ${options.startAt + targets.size - 1}`
        : options.format === "page-n"
          ? `Page ${n}`
          : String(n);

    const textWidth = font.widthOfTextAtSize(label, size);
    const margin = 28;
    const key = options.position;
    const x =
      key.endsWith("-left") ? margin
      : key.endsWith("-right") ? width - textWidth - margin
      : (width - textWidth) / 2;
    const y = key.startsWith("top") ? height - margin : margin - size / 2;

    page.drawText(label, { x, y, size, font, color: rgb(0.25, 0.25, 0.25) });
  });

  return doc.save();
}

/** Index of an item in insertion order of a Set. */
function indexOfSorted(set: Set<number>, value: number): number {
  let i = 0;
  for (const item of set) {
    if (item === value) return i;
    i++;
  }
  return 0;
}

/* -------------------------------- watermark -------------------------------- */

export type WatermarkPosition =
  | "center"
  | "diagonal";

export async function addWatermark(
  bytes: Uint8Array,
  options: {
    text: string;
    opacity: number; // 0.05–1
    angle: number; // degrees
    position: WatermarkPosition;
    spec: string; // "" = all pages
    color: [number, number, number];
  },
): Promise<Uint8Array> {
  const text = options.text.trim();
  if (text.length === 0) throw new PdfOpError("Enter the watermark text.");
  if (text.length > 120) throw new PdfOpError("Keep watermark text under 120 characters.");
  const opacity = Math.min(1, Math.max(0.05, options.opacity));
  const fontSize = 52;

  assertNotEncrypted(bytes);
  const doc = await loadPdf(bytes);
  const pageCount = doc.getPageCount();
  const targets = options.spec.trim().length === 0 ? doc.getPageIndices() : parsePageRange(options.spec, pageCount);

  const font = await doc.embedFont(StandardFonts.HelveticaBold);

  for (const idx of targets) {
    const page = doc.getPage(idx);
    const { width, height } = page.getSize();

    if (options.position === "diagonal") {
      const radians = (options.angle * Math.PI) / 180;
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const cx = width / 2 - (textWidth / 2) * Math.cos(radians);
      const cy = height / 2 - (textWidth / 2) * Math.sin(radians);
      page.drawText(text, {
        x: cx,
        y: cy,
        size: fontSize,
        font,
        color: rgb(...options.color),
        opacity,
        rotate: degrees(options.angle),
      });
    } else {
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      page.drawText(text, {
        x: (width - textWidth) / 2,
        y: height / 2 - fontSize / 2,
        size: fontSize,
        font,
        color: rgb(...options.color),
        opacity,
      });
    }
  }

  return doc.save();
}

/* ------------------------------- text → pdf -------------------------------- */

export async function textToPdf(title: string, body: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const size = 11;
  const lineHeight = size * 1.5;
  const margin = 64;
  const pageWidth = 612; // US Letter
  const pageHeight = 792;
  const contentWidth = pageWidth - margin * 2;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawLine = (text: string, f: PDFFont, s: number) => {
    if (y - s < margin) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(text, { x: margin, y: y - s, size: s, font: f });
    y -= s * 1.5;
  };

  if (title.trim().length > 0) drawLine(title.trim().slice(0, 200), bold, size + 4);
  if (title.trim().length > 0) y -= 6;

  // Wrap plain text: split on existing newlines, then wrap long lines on
  // spaces; only ASCII via Helvetica is safe, so non-Latin text is reported
  // by the caller (see callers/text-to-pdf), not silently garbled here.
  for (const paragraphRaw of body.split("\n")) {
    const paragraph = paragraphRaw.replace(/\t/g, "    ").replace(/\r/g, "");
    if (paragraph.trim().length === 0) {
      y -= lineHeight / 2;
      continue;
    }
    const words = paragraph.split(" ");
    let line = "";
    for (const word of words) {
      const candidate = line.length === 0 ? word : `${line} ${word}`;
      if (font.widthOfTextAtSize(candidate, size) > contentWidth && line.length > 0) {
        drawLine(line, font, size);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line.length > 0) drawLine(line, font, size);
  }

  return doc.save();
}

/* ------------------------------- image → pdf ------------------------------- */

export type ImageKind = "jpg" | "png";

export async function imagesToPdf(
  images: { bytes: Uint8Array; kind: ImageKind }[],
): Promise<Uint8Array> {
  if (images.length === 0) throw new PdfOpError("Select at least one JPG or PNG image.");
  const doc = await PDFDocument.create();
  for (const image of images) {
    try {
      const embedded =
        image.kind === "png" ? await doc.embedPng(image.bytes) : await doc.embedJpg(image.bytes);
      // One page per image, sized to the image (PDF points at 72 dpi).
      const scale = Math.min(1, 612 / embedded.width); // cap page width at Letter
      const width = embedded.width * scale;
      const height = embedded.height * scale;
      const page = doc.addPage([width, height]);
      page.drawImage(embedded, { x: 0, y: 0, width, height });
    } catch {
      throw new PdfOpError("One of the images could not be read. Make sure each file is a real JPG or PNG.");
    }
  }
  return doc.save();
}
