import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveResource } from "@/lib/search/resolve";
import { executeSearch } from "@/lib/search/execute";
import { recordToCitation } from "@/lib/citations/record-to-citation";
import { formatCitation } from "@/lib/citations/styles";
import {
  CITATION_STYLES,
  type CitationData,
  type CitationStyle,
  type FormattedCitation,
} from "@/lib/citations/types";

export const dynamic = "force-dynamic";

/**
 * Resolve a list of DOIs / titles / search phrases into citation records.
 * Bounded to 10 inputs; every input reports honestly (resolved or
 * not-found with the reason). No invented matches.
 */

const bodySchema = z.object({
  inputs: z.array(z.string().trim().min(2).max(400)).min(1).max(10),
  style: z.enum(["apa", "mla", "chicago", "ieee", "vancouver", "harvard"]).default("apa"),
});

const DOI_RE = /^10\.\d{4,9}\/\S+$/i;

interface ResolveOutcome {
  input: string;
  status: "resolved" | "not-found";
  citation?: FormattedCitation;
  /** Underlying metadata so the client can hand it to the export route. */
  data?: CitationData;
  recordTitle?: string;
  message?: string;
}

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
          message: parsed.error.issues[0]?.message ?? "Invalid request",
          retryable: false,
        },
      },
      { status: 400 },
    );
  }

  const { inputs, style } = parsed.data;
  const outcomes: ResolveOutcome[] = [];

  for (const input of inputs) {
    try {
      if (DOI_RE.test(input)) {
        const record = await resolveResource(input);
        if (record) {
          const data = recordToCitation(record);
          outcomes.push({
            input,
            status: "resolved",
            recordTitle: record.title,
            data,
            citation: formatCitation(data, style as CitationStyle, outcomes.length + 1),
          });
          continue;
        }
        // Fall through to a keyword search with the DOI string — sometimes
        // the DOI is a preprint suffix Crossref lacks but OpenAlex knows.
      }

      const search = await executeSearch({
        query: input,
        mode: "auto",
        filters: {},
        sort: "relevance",
      });
      const best = search.results[0];
      if (best) {
        const data = recordToCitation(best);
        outcomes.push({
          input,
          status: "resolved",
          recordTitle: best.title,
          data,
          citation: formatCitation(data, style as CitationStyle, outcomes.length + 1),
        });
      } else {
        outcomes.push({
          input,
          status: "not-found",
          message:
            "No source matched this input. Check the DOI or title, or search with more of the title words.",
        });
      }
    } catch {
      outcomes.push({
        input,
        status: "not-found",
        message: "Could not look this up right now. Try again in a moment.",
      });
    }
  }

  return NextResponse.json(
    {
      outcomes,
      style,
      styles: CITATION_STYLES,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export type { CitationData };
