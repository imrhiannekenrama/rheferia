import Link from "next/link";
import { brand } from "@/lib/config/brand";
import { Card, CardContent } from "@/components/ui/card";

const EXAMPLES = [
  {
    label: "Classroom response systems and student engagement",
    query: "Offline Classroom Response Systems and Student Engagement in Grade 10 Mathematics",
  },
  {
    label: "Reading comprehension in secondary education",
    query: "Improving reading comprehension among junior high school students",
  },
  { label: "A known paper title", query: "The inverted-U relationship between study hours and performance" },
  { label: "A DOI", query: "10.1038/nature12373" },
];

const STEPS = [
  {
    title: "Search",
    body: "Enter a proposed study title, research question, DOI, or keywords. Rheferia queries scholarly sources like OpenAlex and Crossref.",
  },
  {
    title: "Save",
    body: "Review sources with clear access status and provenance. Save the useful ones into private projects with your own notes.",
  },
  {
    title: "Cite",
    body: "Build reference lists in APA, MLA, Chicago, IEEE, or Vancouver and export them as Word, PDF, BibTeX, RIS, and more.",
  },
];

export default function HomePage() {
  return (
    <main id="main-content">
      {/* Hero with the search field as the centerpiece */}
      <section className="mx-auto max-w-3xl px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28">
        <p className="mb-3 text-xs font-medium tracking-widest text-muted-foreground uppercase">
          {brand.features.search}
        </p>
        <h1 className="font-serif text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
          {brand.tagline}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[15.5px] text-muted-foreground">
          Search a proposed study title, a research question, a DOI, or a
          topic. {brand.claims.search}
        </p>

        <form action="/search" className="mx-auto mt-8 max-w-2xl">
          <label htmlFor="home-search" className="sr-only">
            Enter your study title, research question, DOI, or keywords
          </label>
          <div className="flex items-center gap-2 rounded-lg border bg-card p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-ring">
            <input
              id="home-search"
              name="q"
              type="search"
              placeholder="Paste a study title, question, or DOI…"
              className="h-10 min-w-0 flex-1 rounded-md bg-transparent px-3 text-[15px] outline-none placeholder:text-muted-foreground/70"
            />
            <button
              type="submit"
              className="h-10 shrink-0 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Search
            </button>
          </div>

          {/* Progressive disclosure: advanced options start collapsed */}
          <details className="mt-3 text-left">
            <summary className="cursor-pointer select-none text-sm text-muted-foreground hover:text-foreground">
              Advanced search
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg border bg-card p-4 text-left sm:grid-cols-4">
              <div className="col-span-1">
                <label htmlFor="adv-year-from" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Year from
                </label>
                <input
                  id="adv-year-from"
                  name="yearFrom"
                  inputMode="numeric"
                  placeholder="2015"
                  className="h-8 w-full rounded-md border border-input bg-card px-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="adv-year-to" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Year to
                </label>
                <input
                  id="adv-year-to"
                  name="yearTo"
                  inputMode="numeric"
                  placeholder="2026"
                  className="h-8 w-full rounded-md border border-input bg-card px-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="adv-type" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Type
                </label>
                <select id="adv-type" name="types" className="h-8 w-full rounded-md border border-input bg-card px-2 text-sm">
                  <option value="">Any</option>
                  <option value="journal-article">Journal article</option>
                  <option value="preprint">Preprint</option>
                  <option value="book">Book</option>
                  <option value="thesis">Thesis</option>
                  <option value="report">Report</option>
                  <option value="dataset">Dataset</option>
                </select>
              </div>
              <div>
                <label htmlFor="adv-oa" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Access
                </label>
                <select id="adv-oa" name="openAccess" className="h-8 w-full rounded-md border border-input bg-card px-2 text-sm">
                  <option value="">Any</option>
                  <option value="true">Open access only</option>
                </select>
              </div>
            </div>
          </details>
        </form>

        {/* Example queries, clearly labeled */}
        <p className="mt-6 text-xs text-muted-foreground">
          Examples to try:
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((ex) => (
            <Link
              key={ex.query}
              href={`/search?q=${encodeURIComponent(ex.query)}`}
              className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {ex.label}
            </Link>
          ))}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          No account needed to try a search. Projects, citation exports,
          and cloud conversions need a free account.
        </p>
      </section>

      {/* Discover → Save → Cite */}
      <section className="border-t bg-card/40">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-14 sm:grid-cols-3 sm:px-6">
          {STEPS.map((step, i) => (
            <Card key={step.title}>
              <CardContent className="p-5">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  <h2 className="font-semibold">{step.title}</h2>
                </div>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Tools preview */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-2xl font-semibold tracking-tight">
            {brand.features.tools}
          </h2>
          <Link href="/tools" className="text-sm text-primary hover:underline">
            Browse all tools →
          </Link>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Convert PDF to Word and back, extract text, merge, split, rotate,
          and more. Many tools run entirely in your browser.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {[
            { name: "PDF → Word", slug: "pdf-to-word" },
            { name: "Word → PDF", slug: "word-to-pdf" },
            { name: "Merge PDFs", slug: "merge-pdf" },
            { name: "PDF → Text", slug: "pdf-to-text" },
          ].map((tool) => (
            <Link
              key={tool.slug}
              href={`/tools/${tool.slug}`}
              className="rounded-lg border bg-card p-4 text-sm font-medium transition-colors hover:border-primary/40"
            >
              {tool.name}
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                {tool.slug === "pdf-to-word" || tool.slug === "word-to-pdf"
                  ? "Cloud converter"
                  : "Processed on your device"}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

