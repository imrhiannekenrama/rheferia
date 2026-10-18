import type { Metadata } from "next";
import { CitationBuilder } from "@/components/citations/citation-builder";
import { CITATION_STYLES } from "@/lib/citations/types";

export const metadata: Metadata = {
  title: "Citation builder",
  description:
    "Paste DOIs or titles, resolve real sources, and export formatted reference lists in APA, MLA, Chicago, IEEE, Vancouver, or Harvard.",
};

export default function CitationsPage() {
  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">
        Citation builder
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Resolve real sources by DOI or title, preview them in{" "}
        {CITATION_STYLES.map((s) => s.label).join(", ")}, and export genuine
        files: .txt, .bib (BibTeX), .ris, .docx, or .pdf. Missing metadata is
        flagged for you to review — never filled with invented values.
      </p>

      <div className="mt-8">
        <CitationBuilder />
      </div>

      <section className="mt-12 space-y-3 text-sm text-muted-foreground">
        <h2 className="text-base font-medium text-foreground">What this does honestly</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            Looks up each input against live Crossref and OpenAlex metadata;
            if nothing matches, you see that instead of a fake citation.
          </li>
          <li>
            Formatted citations include in-text forms, and each style follows
            its published guide (numbered styles assign [n] by list order).
          </li>
          <li>
            Exports are real files generated on the server: a Word document
            with hanging indents, a PDF, BibTeX/RIS for reference managers,
            and plain text.
          </li>
        </ul>
      </section>
    </main>
  );
}
