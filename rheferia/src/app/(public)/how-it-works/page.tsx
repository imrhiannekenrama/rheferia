import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How it works",
  description: "How Rheferia searches, what it can and cannot access, and how its tools work.",
};

export default function HowItWorksPage() {
  return (
    <main id="main-content" className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">How Rheferia works</h1>

      <section className="mt-8">
        <h2 className="font-semibold">Search coverage</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Rheferia queries the scholarly sources it is configured for —
          currently OpenAlex and Crossref, with optional Semantic Scholar and
          web search. It does not index the entire internet, and it cannot
          guarantee that every relevant reference exists in those sources.
          A DOI can be resolved directly.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">Access to full texts</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Some results have open-access full texts that you can open or
          download. Others only have a link to the publisher, which may
          require institutional access or purchase. Rheferia shows each
          result&apos;s access status honestly and never bypasses paywalls
          or access controls. A &quot;Download&quot; action appears only
          when a real file link exists.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">Citations</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Citations are generated from provider metadata using a citation
          engine, not invented. Missing fields follow the style&apos;s rules
          for missing data, and records that look incomplete are flagged for
          your review. Always verify citations against the original source.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">Document tools</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Tools marked &quot;Processed on your device&quot; run entirely in
          your browser — the file is not uploaded anywhere. Cloud
          conversions (PDF to Word, Word to PDF) send your file to a
          configured conversion provider and clearly say so before you
          upload. Converted files are your documents; Rheferia never claims
          a converted file is the publisher&apos;s original.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">What Rheferia will not do</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>Claim to find every reference on the internet</li>
          <li>Bypass paywalls or publisher authentication</li>
          <li>Rehost papers without clear redistribution rights</li>
          <li>Invent citation details that metadata does not contain</li>
          <li>Pretend a file was converted when only its name changed</li>
        </ul>
      </section>
    </main>
  );
}
