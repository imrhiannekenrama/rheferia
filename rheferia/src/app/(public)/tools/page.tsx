import type { Metadata } from "next";
import Link from "next/link";
import { TOOLS_BY_GROUP } from "@/lib/conversions/tool-registry";

export const metadata: Metadata = {
  title: "Tools",
  description: "Document conversion and PDF tools for researchers.",
};

export default function ToolsPage() {
  return (
    <main id="main-content" className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">
        Rheferia Tools
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Conversion and PDF tools for research documents. Every tool runs
        entirely in your browser — your files are never uploaded
        anywhere.
      </p>

      <div className="mt-8 space-y-10">
        {Object.entries(TOOLS_BY_GROUP).map(([group, tools]) => (
          <section key={group}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {group}
            </h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {tools.map((tool) => (
                <li key={tool.slug}>
                  <Link
                    href={`/tools/${tool.slug}`}
                    className="block h-full rounded-lg border bg-card p-4 transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{tool.name}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{tool.purpose}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
