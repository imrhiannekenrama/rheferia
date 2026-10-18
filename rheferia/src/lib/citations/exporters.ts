/**
 * File exporters for reference lists: .txt, .docx (real Word document via
 * the `docx` package), and .pdf (via `pdfkit`). Output reflects the same
 * formatted citations the user previews — no silent reformatting.
 */

import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";
import PDFDocument from "pdfkit";
import type { FormattedCitation } from "./types";
import type { CitationStyle } from "./types";

const STYLE_LABELS: Record<CitationStyle, string> = {
  apa: "APA 7th edition",
  mla: "MLA 9th edition",
  chicago: "Chicago 17th edition",
  ieee: "IEEE",
  vancouver: "Vancouver (ICMJE)",
  harvard: "Harvard",
};

/** Strip markdown emphasis markers for plain-text exports. */
function plain(text: string): string {
  return text.replace(/\*/g, "");
}

export function toPlainText(items: FormattedCitation[], style: CitationStyle): string {
  const header = `References (${STYLE_LABELS[style]})\n\n`;
  return header + items.map((c) => plain(c.reference)).join("\n\n") + "\n";
}

export async function toDocx(
  items: FormattedCitation[],
  style: CitationStyle,
): Promise<Uint8Array> {
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: "References", bold: true, size: 28 })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Formatted in ${STYLE_LABELS[style]}`, italics: true, size: 20 }),
      ],
      spacing: { after: 360 },
    }),
  ];

  for (const citation of items) {
    children.push(
      new Paragraph({
        // Emphasis markers from the style formatters become italics.
        children: parseRuns(plainRuns(citation.reference)),
        spacing: { after: 240 },
        indent: { left: 720, hanging: 720 }, // hanging indent, standard for references
      }),
    );
  }

  const doc = new Document({
    sections: [{ children }],
  });
  return Packer.toBuffer(doc).then((buffer) => new Uint8Array(buffer));
}

interface Run {
  text: string;
  italics?: boolean;
}

function plainRuns(reference: string): Run[] {
  // Split on *italic* markers into runs.
  const runs: Run[] = [];
  const parts = reference.split("*");
  parts.forEach((part, i) => {
    if (part) runs.push({ text: part, italics: i % 2 === 1 });
  });
  return runs;
}

function parseRuns(runs: Run[]): TextRun[] {
  return runs.map((r) => new TextRun({ text: r.text, italics: r.italics, size: 22 }));
}

export function toPdf(items: FormattedCitation[], style: CitationStyle): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margins: { top: 72, bottom: 72, left: 72, right: 72 } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    doc.on("error", reject);

    doc.fontSize(20).font("Helvetica-Bold").text("References");
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica-Oblique").text(`Formatted in ${STYLE_LABELS[style]}`);
    doc.moveDown(1.5);

    for (const citation of items) {
      const runs = plainRuns(citation.reference);
      const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      let first = true;
      for (const run of runs) {
        doc.font(run.italics ? "Helvetica-Oblique" : "Helvetica").fontSize(11);
        const options: Record<string, unknown> = {
          width,
          paragraphGap: 0,
          lineGap: 3,
          continued: true,
          // Hanging indent: every line but the first is indented.
          indent: first ? 0 : 28,
        };
        if (first) {
          doc.text(run.text, options);
        } else {
          doc.text(run.text, options);
        }
        first = false;
      }
      doc.text("", { continued: false });
      doc.moveDown(0.7);
    }

    doc.end();
  });
}
