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
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="hero-glow pointer-events-none absolute inset-0"
        />
        <div className="relative mx-auto max-w-3xl px-4 pt-12 pb-10 text-center sm:px-6 sm:pt-28 sm:pb-16">
          <p className="fade-up mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1 text-xs font-medium tracking-wide text-muted-foreground shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
            {brand.features.search}
          </p>
          <h1 className="fade-up fade-up-1 font-serif text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">
            Where ideas find
            <br className="hidden sm:block" /> their{" "}
            <span className="text-primary italic">sources</span>.
          </h1>
          <p className="fade-up fade-up-2 mx-auto mt-5 max-w-xl text-[15.5px] text-muted-foreground">
            Search a proposed study title, a research question, a DOI, or a
            topic. {brand.claims.search}
          </p>

          <form action="/search" className="fade-up fade-up-3 mx-auto mt-9 max-w-2xl">
            <label htmlFor="home-search" className="sr-only">
              Enter your study title, research question, DOI, or keywords
            </label>
            <div className="search-shell flex flex-col gap-2 rounded-xl border bg-card p-2 sm:flex-row sm:items-center focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
              <div className="flex flex-1 items-center gap-2">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="ml-2 h-4.5 w-4.5 shrink-0 text-muted-foreground"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                id="home-search"
                name="q"
                type="search"
                placeholder="Paste a study title, question, or DOI…"
                className="h-11 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-[15px] outline-none placeholder:text-muted-foreground/70"
              />
              </div>
              <button
                type="submit"
                className="h-11 w-full rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 sm:w-auto sm:shrink-0"
              >
                Search
              </button>
            </div>

            {/* Progressive disclosure: advanced options start collapsed */}
            <details className="mt-3 text-left">
              <summary className="cursor-pointer select-none text-sm text-muted-foreground hover:text-foreground">
                Advanced search
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border bg-card p-4 text-left shadow-sm sm:grid-cols-4">
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
          <div className="fade-up fade-up-4">
            <p className="mt-7 text-xs text-muted-foreground">
              Examples to try:
            </p>
            <div className="mt-2.5 flex flex-wrap justify-center gap-2">
              {EXAMPLES.map((ex, i) => (
                <Link
                  key={ex.query}
                  href={`/search?q=${encodeURIComponent(ex.query)}`}
                  className={
                    "rounded-full border bg-card px-3.5 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground" +
                    (i < 2 ? " hidden sm:inline-flex" : "") +
                    " hover-lift"
                  }
                >
                  {ex.label}
                </Link>
              ))}
            </div>

            <p className="mt-5 text-xs text-muted-foreground">
              No account needed to try a search. Projects and citation
              exports need a free account.
            </p>
          </div>
        </div>
      </section>

      {/* Discover → Save → Cite */}
      <section className="border-t bg-card/40">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10 sm:grid-cols-3 sm:px-6 sm:py-14">
          {STEPS.map((step, i) => (
            <Card key={step.title} className="hover-lift">
              <CardContent className="p-5">
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold " +
                      (i === 1
                        ? "bg-accent text-accent-foreground"
                        : "bg-primary/10 text-primary")
                    }
                  >
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
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-2xl font-semibold tracking-tight">
            {brand.features.tools}
          </h2>
          <Link
            href="/tools"
            className="group text-sm font-medium text-primary hover:underline"
          >
            Browse all tools
            <span className="inline-block transition-transform group-hover:translate-x-0.5"> →</span>
          </Link>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Extract text, merge, split, rotate, watermark, convert images
          and more. Every tool runs entirely in your browser — your files
          are never uploaded anywhere.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {[
            { name: "Merge PDFs", slug: "merge-pdf" },
            { name: "PDF → Text", slug: "pdf-to-text" },
            { name: "Rotate PDF pages", slug: "rotate-pdf" },
            { name: "Split PDF", slug: "split-pdf" },
          ].map((tool) => (
            <Link
              key={tool.slug}
              href={`/tools/${tool.slug}`}
              className="hover-lift group/tool rounded-xl border bg-card p-4 text-sm font-medium shadow-sm hover:border-primary/40"
            >
              <span className="inline-block transition-transform group-hover/tool:translate-x-0.5">
                {tool.name}
              </span>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                Processed on your device
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}