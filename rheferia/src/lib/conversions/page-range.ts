/**
 * Page-selection parsing shared by split/extract/reorder/rotate.
 * Accepts forms like "1-3, 5, 8-", with honest errors for junk input.
 */

export class RangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RangeError";
  }
}

export interface RangeOptions {
  /** Total pages in the document, used to validate and to allow "8-" tails. */
  pageCount: number;
  /** Treat 1-based input; output is 0-based indices, deduped, in input order. */
}

/**
 * Parse "1-3, 5, 8-" into 0-based page indices. Throws RangeError with a
 * user-facing message when the input cannot be honored.
 */
export function parsePageRange(spec: string, pageCount: number): number[] {
  const text = spec.trim();
  if (text.length === 0) throw new RangeError("Enter at least one page or range, e.g. 1-3, 5.");

  const seen = new Set<number>();
  const out: number[] = [];

  for (const partRaw of text.split(",")) {
    const part = partRaw.trim();
    if (part.length === 0) throw new RangeError(`Empty range near "${partRaw.trim()}". Remove the stray comma.`);
    const match = /^(\d+)(?:\s*-\s*(\d+)?)?$/.exec(part);
    if (!match) throw new RangeError(`"${part}" is not a page or range. Use forms like 1, 3-5, or 8-.`);
    const start = Number(match[1]);
    if (start < 1 || start > pageCount) {
      throw new RangeError(`Page ${start} is outside this document (it has ${pageCount} pages).`);
    }
    if (match[2] != null) {
      const end = Number(match[2]);
      if (end < start) throw new RangeError(`Range ${start}-${end} runs backwards. Use the smaller number first.`);
      if (end > pageCount) {
        throw new RangeError(`Page ${end} is outside this document (it has ${pageCount} pages).`);
      }
      for (let p = start; p <= end; p++) {
        const idx = p - 1;
        if (!seen.has(idx)) {
          seen.add(idx);
          out.push(idx);
        }
      }
    } else if (match[1] && part.includes("-")) {
      // Open range "8-": through the end of the document.
      for (let p = start; p <= pageCount; p++) {
        const idx = p - 1;
        if (!seen.has(idx)) {
          seen.add(idx);
          out.push(idx);
        }
      }
    } else {
      const idx = start - 1;
      if (!seen.has(idx)) {
        seen.add(idx);
        out.push(idx);
      }
    }
  }

  if (out.length === 0) throw new RangeError("The selection matched no pages.");
  return out;
}

/**
 * Parse a reorder spec: comma-separated pages in the desired order; page
 * numbers not listed are dropped. Allows repeats (duplicate a page).
 */
export function parseReorderSpec(spec: string, pageCount: number): number[] {
  const text = spec.trim();
  if (text.length === 0) throw new RangeError("Enter the page order, e.g. 3, 1, 2.");
  const out: number[] = [];
  for (const partRaw of text.split(",")) {
    const part = partRaw.trim();
    const match = /^(\d+)$/.exec(part);
    if (!match) throw new RangeError(`"${part}" is not a page number.`);
    const p = Number(match[1]);
    if (p < 1 || p > pageCount) {
      throw new RangeError(`Page ${p} is outside this document (it has ${pageCount} pages).`);
    }
    out.push(p - 1);
  }
  if (out.length === 0) throw new RangeError("The order matched no pages.");
  return out;
}
