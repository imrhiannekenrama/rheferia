/**
 * PDF → images rendering. Browser-only (needs canvas); the pdf.js page
 * renderer draws onto an OffscreenCanvas/HTMLCanvasElement. In Node there
 * is no canvas, so callers must use this only inside the browser tool.
 */

export interface RenderedPage {
  page: number;
  /** PNG or JPEG bytes depending on requested format. */
  bytes: Uint8Array;
}

export type ImageFormat = "png" | "jpeg";

export class PdfImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfImageError";
  }
}

/**
 * Render selected pages (1-based list) to images at a scale factor.
 */
export async function renderPdfPages(
  bytes: Uint8Array,
  pages: number[],
  scale: number,
  format: ImageFormat,
): Promise<RenderedPage[]> {
  if (typeof document === "undefined") {
    throw new PdfImageError("This tool runs in the browser only.");
  }

  const pdfjs = await import("pdfjs-dist").then((mod) => {
    mod.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    return mod;
  });

  let doc;
  try {
    doc = await pdfjs.getDocument({ data: bytes.slice(0), isEvalSupported: false }).promise;
  } catch {
    throw new PdfImageError("This file is not a readable PDF. It may be corrupt or password-protected.");
  }

  const out: RenderedPage[] = [];
  const total = doc.numPages;

  try {
    for (const pageNum of pages) {
      if (pageNum < 1 || pageNum > total) {
        throw new PdfImageError(`Page ${pageNum} is outside this document (it has ${total} pages).`);
      }
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new PdfImageError("Your browser blocked canvas rendering.");
      await page.render({ canvasContext: ctx, viewport }).promise;

      const mime = format === "png" ? "image/png" : "image/jpeg";
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, mime, 0.92),
      );
      if (!blob) throw new PdfImageError("Image encoding failed on your browser.");
      out.push({ page: pageNum, bytes: new Uint8Array(await blob.arrayBuffer()) });
    }
  } finally {
    await doc.destroy();
  }

  return out;
}
