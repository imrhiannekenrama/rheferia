import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { formatCitation } from "@/lib/citations/styles";
import type { CitationData, CitationStyle, FormattedCitation } from "@/lib/citations/types";
import { toBibtex } from "@/lib/citations/bibtex";
import { toRis } from "@/lib/citations/ris";
import { toPlainText, toDocx, toPdf } from "@/lib/citations/exporters";

export const dynamic = "force-dynamic";

/**
 * Export a reference list as a real file: .txt, .bib, .ris, .docx, .pdf.
 * The request carries citation data (the user previews exactly what is
 * exported) and a style. Bounded to 100 entries.
 */

const citationSchema = z.object({
  recordId: z.string().min(1).max(120),
  authors: z
    .array(
      z.object({
        family: z.string().max(300).nullish(),
        given: z.string().max(300).nullish(),
        raw: z.string().min(1).max(400),
        isOrganization: z.boolean().optional(),
      }),
    )
    .max(50),
  year: z.number().int().min(1000).max(3000).nullable(),
  title: z.string().min(1).max(2000),
  resourceType: z
    .enum([
      "journal-article", "preprint", "book", "book-chapter", "conference-paper",
      "thesis", "report", "dataset", "webpage", "other",
    ]),
  container: z.string().max(2000).nullable(),
  publisher: z.string().max(500).nullable(),
  volume: z.string().max(50).nullable(),
  issue: z.string().max(50).nullable(),
  pages: z.string().max(100).nullable(),
  doi: z.string().max(200).nullable(),
  url: z.string().max(2000).nullable(),
  edition: z.string().max(100).nullable(),
});

const bodySchema = z.object({
  citations: z.array(citationSchema).min(1).max(100),
  style: z.enum(["apa", "mla", "chicago", "ieee", "vancouver", "harvard"]),
  format: z.enum(["txt", "bib", "ris", "docx", "pdf"]),
});

const MIME: Record<string, [string, string]> = {
  txt: ["text/plain; charset=utf-8", "references.txt"],
  bib: ["application/x-bibtex; charset=utf-8", "references.bib"],
  ris: ["application/x-research-info-systems; charset=utf-8", "references.ris"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "references.docx"],
  pdf: ["application/pdf", "references.pdf"],
};

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Request body must be JSON.", retryable: false } },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: parsed.error.issues[0]?.message ?? "Invalid export request",
          retryable: false,
        },
      },
      { status: 400 },
    );
  }

  const { citations, style, format } = parsed.data;
  const data = citations as CitationData[];
  const formatted: FormattedCitation[] = data.map((c, i) =>
    formatCitation(c, style as CitationStyle, i + 1),
  );

  let bytes: Uint8Array;
  let text: string | null = null;

  switch (format) {
    case "txt":
      text = toPlainText(formatted, style as CitationStyle);
      break;
    case "bib":
      text = toBibtex(data);
      break;
    case "ris":
      text = toRis(data);
      break;
    case "docx":
      bytes = await toDocx(formatted, style as CitationStyle);
      break;
    case "pdf":
      bytes = await toPdf(formatted, style as CitationStyle);
      break;
  }

  const [mime, filename] = MIME[format]!;
  const headers: Record<string, string> = {
    "Content-Type": mime,
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  };

  if (text != null) {
    return new NextResponse(text, { headers });
  }
  return new NextResponse(Buffer.from(bytes!), { headers });
}
