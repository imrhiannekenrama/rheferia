import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/config/brand";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <main id="main-content" className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">About {brand.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{brand.tagline}</p>

      <section className="mt-8 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <div>
          <h2 className="font-semibold text-foreground">Who created it</h2>
          <p className="mt-1">
            {brand.name} was created and is maintained by Rhianne
            (imrhiannekenrama on GitHub). The name {brand.name} is a coined
            blend of &quot;Rhianne&quot; and &quot;references&quot;.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-foreground">What {brand.name} offers</h2>
          <div className="mt-2 space-y-3">
            <div>
              <p className="font-medium text-foreground">{brand.features.search}</p>
              <p className="mt-1">
                Search scholarly sources by study title, research question,
                DOI, or topic. {brand.name} queries OpenAlex and Crossref and
                shows each result&apos;s access status honestly. Saving sources
                into private projects and exporting citation lists requires a
                free account.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">{brand.features.cite}</p>
              <p className="mt-1">
                Resolve real sources by DOI or title and build reference lists
                in six styles (APA 7, MLA 9, Chicago 17, IEEE, Vancouver,
                Harvard) with genuine file exports: Word, PDF, BibTeX, RIS,
                and plain text. Missing metadata is flagged for review, never
                invented.
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">{brand.features.tools}</p>
              <p className="mt-1">
                Document tools for research files: PDF merge, split, rotate,
                extract, reorder, watermark, page numbers, text and image
                conversions, and more. Every tool runs entirely in your
                browser, so your files are never uploaded to any server.
              </p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="font-semibold text-foreground">Honest limits</h2>
          <p className="mt-1">
            {brand.name} does not index the entire internet and cannot
            guarantee that every relevant reference exists in the sources it
            searches. It never bypasses paywalls, never invents citation
            details, and never claims a file was converted when only its name
            changed. See <Link href="/how-it-works" className="underline hover:text-foreground">How it works</Link> for the full picture.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-foreground">Policies</h2>
          <p className="mt-1">
            Read our{" "}
            <Link href="/terms" className="underline hover:text-foreground">Terms of use</Link> and{" "}
            <Link href="/privacy" className="underline hover:text-foreground">Privacy policy</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}