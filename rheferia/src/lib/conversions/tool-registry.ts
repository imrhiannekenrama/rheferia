/**
 * Rheferia Tools registry.
 *
 * Every tool runs entirely in the visitor's browser — files are never
 * uploaded to any server. There are no cloud tools by design: keeping
 * everything local means the site stays free to run, private by
 * default, and honest about what happens to your documents.
 */

export interface ToolSpec {
  slug: string;
  name: string;
  purpose: string;
  inputs: string[];
  output: string;
  /** True when the tool has meaningful options to configure. */
  notes?: string;
}

export const TOOLS: ToolSpec[] = [
  {
    slug: "pdf-to-text",
    name: "PDF → Text",
    purpose: "Extract embedded text from a PDF.",
    inputs: [".pdf"],
    output: ".txt",
    notes: "Extracts embedded text only. Scanned pages without a text layer require OCR, which is not available; those pages are reported honestly.",
  },
  {
    slug: "text-to-pdf",
    name: "Text → PDF",
    purpose: "Turn a plain text file into a readable PDF.",
    inputs: [".txt"],
    output: ".pdf",
  },
  {
    slug: "image-to-pdf",
    name: "JPG/PNG → PDF",
    purpose: "Combine images into a single PDF.",
    inputs: [".jpg", ".jpeg", ".png"],
    output: ".pdf",
  },
  {
    slug: "pdf-to-images",
    name: "PDF → JPG/PNG",
    purpose: "Export PDF pages as images, with a ZIP for multiple pages.",
    inputs: [".pdf"],
    output: ".jpg/.png (ZIP for multiple)",
  },
  {
    slug: "merge-pdf",
    name: "Merge PDFs",
    purpose: "Combine multiple PDFs into one, in your chosen order.",
    inputs: [".pdf"],
    output: ".pdf",
  },
  {
    slug: "split-pdf",
    name: "Split PDF",
    purpose: "Split a PDF by page ranges into separate files.",
    inputs: [".pdf"],
    output: ".pdf (ZIP for multiple)",
  },
  {
    slug: "extract-pdf-pages",
    name: "Extract PDF pages",
    purpose: "Keep only selected pages, in your chosen order.",
    inputs: [".pdf"],
    output: ".pdf",
  },
  {
    slug: "reorder-pdf-pages",
    name: "Reorder/delete PDF pages",
    purpose: "Reorder or remove pages from a PDF.",
    inputs: [".pdf"],
    output: ".pdf",
  },
  {
    slug: "rotate-pdf",
    name: "Rotate PDF pages",
    purpose: "Rotate chosen pages or the whole document.",
    inputs: [".pdf"],
    output: ".pdf",
  },
  {
    slug: "add-page-numbers",
    name: "Add page numbers",
    purpose: "Add page numbers with position, start, and range options.",
    inputs: [".pdf"],
    output: ".pdf",
  },
  {
    slug: "watermark-pdf",
    name: "Add text watermark",
    purpose: "Stamp a text watermark with position, opacity, and rotation.",
    inputs: [".pdf"],
    output: ".pdf",
  },
];

const CONVERSION_SLUGS = new Set([
  "pdf-to-text",
  "text-to-pdf",
  "image-to-pdf",
  "pdf-to-images",
]);

export const TOOLS_BY_GROUP: Record<string, ToolSpec[]> = {
  "Conversions": TOOLS.filter((t) => CONVERSION_SLUGS.has(t.slug)),
  "PDF tools": TOOLS.filter((t) => !CONVERSION_SLUGS.has(t.slug)),
};

export function getTool(slug: string): ToolSpec | undefined {
  return TOOLS.find((t) => t.slug === slug);
}
