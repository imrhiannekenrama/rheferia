"use client";

/**
 * Citation builder: paste DOIs or titles, resolve them into real records,
 * preview in any style, review missing-field flags, and export real
 * files (.txt/.bib/.ris/.docx/.pdf). Everything is honest about what was
 * found and what metadata is missing.
 */

import { useState } from "react";
import { CITATION_STYLES, type CitationData, type CitationStyle, type FormattedCitation, type MissingField } from "@/lib/citations/types";

interface Outcome {
  input: string;
  status: "resolved" | "not-found";
  citation?: FormattedCitation;
  data?: CitationData;
  recordTitle?: string;
  message?: string;
}

const FORMATS = ["txt", "bib", "ris", "docx", "pdf"] as const;
type Format = (typeof FORMATS)[number];

const FIELD_LABELS: Record<MissingField, string> = {
  authors: "authors",
  year: "year",
  container: "journal/container",
  volume: "volume",
  issue: "issue",
  pages: "pages",
  doi: "DOI",
  publisher: "publisher",
};

export function CitationBuilder() {
  const [inputs, setInputs] = useState("");
  const [style, setStyle] = useState<CitationStyle>("apa");
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolved = outcomes.filter((o) => o.status === "resolved" && o.citation);
  const citations = resolved.map((o) => o.citation!);

  async function resolve() {
    const lines = inputs
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 10);
    if (lines.length === 0) return;

    setLoading(true);
    setError(null);
    setOutcomes([]);
    try {
      const response = await fetch("/api/citations/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: lines, style }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error?.message ?? "Something went wrong. Try again.");
      } else {
        setOutcomes(data.outcomes as Outcome[]);
      }
    } catch {
      setError("Network problem while resolving. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function restyle(nextStyle: CitationStyle) {
    setStyle(nextStyle);
    if (outcomes.length === 0) return;
    // Re-render previews locally per style by re-resolving is wasteful;
    // instead we re-request only formatting via the export-less resolve
    // with the same inputs, so numbering stays stable.
    const lines = outcomes.map((o) => o.input);
    setLoading(true);
    try {
      const response = await fetch("/api/citations/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: lines, style: nextStyle }),
      });
      const data = await response.json();
      if (response.ok) setOutcomes(data.outcomes as Outcome[]);
    } catch {
      // Style switch failed silently is unacceptable; report honestly.
      setError("Could not switch style right now. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function exportList(format: Format) {
    if (citations.length === 0) return;
    setExporting(format);
    setError(null);
    try {
      const response = await fetch("/api/citations/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          citations: resolved.map((o) => o.data),
          style,
          format,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error?.message ?? "Export failed. Try again.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `references.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export did not complete. Try again.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Input */}
      <section className="rounded-lg border bg-card p-5">
        <label htmlFor="citation-inputs" className="block text-sm font-medium">
          Paste up to 10 DOIs or titles (one per line)
        </label>
        <textarea
          id="citation-inputs"
          value={inputs}
          onChange={(event) => setInputs(event.target.value)}
          rows={4}
          placeholder={"10.1038/nature12373\nThe Effects of Student Engagement on Academic Achievement"}
          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={resolve}
            disabled={loading || !inputs.trim()}
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Resolving…" : "Resolve sources"}
          </button>
          <label htmlFor="citation-style" className="text-sm text-muted-foreground">
            Style
          </label>
          <select
            id="citation-style"
            value={style}
            onChange={(event) => restyle(event.target.value as CitationStyle)}
            className="h-9 rounded-md border border-input bg-card px-2 text-sm"
          >
            {CITATION_STYLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p role="alert" className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </section>

      {/* Results */}
      {outcomes.length > 0 && (
        <section aria-label="Resolved citations">
          <ol className="space-y-4">
            {outcomes.map((outcome, index) => (
              <li key={`${outcome.input}-${index}`} className="rounded-lg border bg-card p-4">
                {outcome.status === "resolved" && outcome.citation ? (
                  <>
                    <p className="font-serif text-[15px] leading-relaxed">{outcome.citation.reference}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      In-text: <span className="font-mono">{outcome.citation.inText}</span>
                    </p>
                    {outcome.citation.missingFields.length > 0 && (
                      <p className="mt-2 rounded-md border border-dashed border-destructive/50 bg-destructive/5 px-3 py-1.5 text-xs text-destructive">
                        Review this: missing{" "}
                        {outcome.citation.missingFields.map((f) => FIELD_LABELS[f]).join(", ")}{" "}
                        in the source metadata.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-destructive">
                    Not resolved: {outcome.input}
                    <span className="mt-1 block text-muted-foreground">{outcome.message}</span>
                  </p>
                )}
              </li>
            ))}
          </ol>

          {/* Exports */}
          <div className="mt-6 rounded-lg border bg-card p-5">
            <h2 className="text-sm font-medium">Export reference list</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {citations.length} resolved{citations.length > 0 ? "" : " so far"}. Missing fields stay
              missing — flagged, never invented.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {FORMATS.map((format) => (
                <button
                  key={format}
                  type="button"
                  onClick={() => exportList(format)}
                  disabled={citations.length === 0 || exporting !== null}
                  className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exporting === format ? "Exporting…" : `.${format}`}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
