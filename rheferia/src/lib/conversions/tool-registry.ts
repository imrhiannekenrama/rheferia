/**
 * Rheferia Tools registry. Each tool declares its execution mode honestly:
 * - "browser": processed on the user's device; no upload.
 * - "cloud": sent to the configured conversion provider.
 * Capability status is computed from configuration at render time.
 */

export type ToolExecution = "browser" | "cloud";

export interface ToolSpec {
  slug: string;
  name: string;
  purpose: string;
  execution: ToolExecution;
  inputs: string[];
  output: string;
  /** True when the tool has meaningful options to configure. */
  notes?: string;
}

export const TOOLS: ToolSpec[] = [
  {
    slug: "pdf-to-word",
    name: "PDF → Word (.docx)",
    purpose: "Convert a PDF into an editable Word document.",
    execution: "cloud",
    inputs: [".pdf"],
    output: ".docx",
    notes: "Real editable DOCX output. Complex layouts can vary.",
  },
  {
    slug: "word-to-pdf",
    name: "Word (.docx) → PDF",
    purpose: "Convert a Word document into a rendered PDF.",
    execution: "cloud",
    inputs: [".docx"],
    output: ".pdf",
  },
  {
    slug: "pdf-to-text",
    name: "PDF → Text",
    purpose: "Extract embedded text from a PDF.",
    execution: "browser",
    inputs: [".pdf"],
    output: ".txt",
    notes: "Extracts embedded text only. Scanned pages without a text layer require OCR, which is not available; those pages are reported honestly.",
  },
  {
    slug: "text-to-pdf",
    name: "Text → PDF",
    purpose: "Turn a plain text file into a readable PDF.",
    execution: "browser",
    inputs: [".txt"],
    output: ".pdf",
  },
  {
    slug: "image-to-pdf",
    name: "JPG/PNG → PDF",
    purpose: "Combine images into a single PDF.",
    execution: "browser",
    inputs: [".jpg", ".jpeg", ".png"],
    output: ".pdf",
  },
  {
    slug: "pdf-to-images",
    name: "PDF → JPG/PNG",
    purpose: "Export PDF pages as images, with a ZIP for multiple pages.",
    execution: "browser",
    inputs: [".pdf"],
    output: ".jpg/.png (ZIP for multiple)",
  },
  {
    slug: "merge-pdf",
    name: "Merge PDFs",
    purpose: "Combine multiple PDFs into one, in your chosen order.",
    execution: "browser",
    inputs: [".pdf"],
    output: ".pdf",
  },
  {
    slug: "split-pdf",
    name: "Split PDF",
    purpose: "Split a PDF by page ranges into separate files.",
    execution: "browser",
    inputs: [".pdf"],
    output: ".pdf (ZIP for multiple)",
  },
  {
    slug: "extract-pdf-pages",
    name: "Extract PDF pages",
    purpose: "Keep only selected pages, in your chosen order.",
    execution: "browser",
    inputs: [".pdf"],
    output: ".pdf",
  },
  {
    slug: "reorder-pdf-pages",
    name: "Reorder/delete PDF pages",
    purpose: "Reorder or remove pages from a PDF.",
    execution: "browser",
    inputs: [".pdf"],
    output: ".pdf",
  },
  {
    slug: "rotate-pdf",
    name: "Rotate PDF pages",
    purpose: "Rotate chosen pages or the whole document.",
    execution: "browser",
    inputs: [".pdf"],
    output: ".pdf",
  },
  {
    slug: "add-page-numbers",
    name: "Add page numbers",
    purpose: "Add page numbers with position, start, and range options.",
    execution: "browser",
    inputs: [".pdf"],
    output: ".pdf",
  },
  {
    slug: "watermark-pdf",
    name: "Add text watermark",
    purpose: "Stamp a text watermark with position, opacity, and rotation.",
    execution: "browser",
    inputs: [".pdf"],
    output: ".pdf",
  },
  {
    slug: "compress-pdf",
    name: "Compress PDF",
    purpose: "Reduce PDF size where genuinely possible.",
    execution: "cloud",
    inputs: [".pdf"],
    output: ".pdf",
    notes: "Shows actual before/after sizes. Some files cannot become smaller.",
  },
  {
    slug: "pdf-to-excel",
    name: "PDF → Excel (.xlsx)",
    purpose: "Pull table-like content from a PDF into a spreadsheet.",
    execution: "cloud",
    inputs: [".pdf"],
    output: ".xlsx",
    notes: "Works best on PDFs with clear tables. Scanned pages need OCR, and messy layouts come out messy — check the result before trusting it.",
  },
  {
    slug: "excel-to-pdf",
    name: "Excel (.xlsx) → PDF",
    purpose: "Convert a spreadsheet into a PDF.",
    execution: "cloud",
    inputs: [".xlsx"],
    output: ".pdf",
  },
  {
    slug: "powerpoint-to-pdf",
    name: "PowerPoint (.pptx) → PDF",
    purpose: "Convert a presentation into a PDF.",
    execution: "cloud",
    inputs: [".pptx"],
    output: ".pdf",
  },
];

export const TOOLS_BY_GROUP: Record<string, ToolSpec[]> = {
  "Conversions": TOOLS.filter((t) => t.execution === "cloud"),
  "PDF tools": TOOLS.filter((t) => t.execution === "browser"),
};

export function getTool(slug: string): ToolSpec | undefined {
  return TOOLS.find((t) => t.slug === slug);
}
