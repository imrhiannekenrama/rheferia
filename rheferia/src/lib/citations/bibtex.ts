/**
 * BibTeX (.bib) serializer. Escape rules follow Tame the BeaST
 * conventions: braces around keys, LaTeX-escaped special characters,
 * no invented fields.
 */

import type { CitationData } from "./types";

function bibtexKey(data: CitationData, index: number): string {
  const first = data.authors[0];
  const family = first?.family ?? first?.raw?.replace(/[^A-Za-z]/g, "") ?? "ref";
  const year = data.year ?? "nd";
  const word = data.title
    .replace(/[^A-Za-z0-9 ]/g, "")
    .split(" ")
    .find((w) => w.length > 3);
  return `${family.replace(/[^A-Za-z]/g, "")}${year}${word ?? index}`.toLowerCase();
}

function escapeTex(value: string): string {
  return value
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function bibType(data: CitationData): string {
  switch (data.resourceType) {
    case "journal-article":
      return "article";
    case "book":
      return "book";
    case "book-chapter":
      return "incollection";
    case "conference-paper":
      return "inproceedings";
    case "thesis":
      return "phdthesis";
    case "report":
      return "techreport";
    case "dataset":
      return "misc";
    case "preprint":
      return "unpublished";
    default:
      return "misc";
  }
}

export function toBibtexEntry(data: CitationData, index: number): string {
  const fields: string[] = [];
  const add = (key: string, value?: string | null) => {
    if (value) fields.push(`  ${key} = {${value}},`);
  };

  if (data.authors.length > 0) {
    const names = data.authors
      .map((a) =>
        a.family && a.given
          ? `${a.family}, ${a.given}`
          : a.isOrganization
            ? `{${a.raw}}`
            : a.raw,
      )
      .join(" and ");
    fields.push(`  author = {${names}},`);
  }
  add("title", escapeTex(data.title));
  if (data.year != null) add("year", String(data.year));
  add("journal", data.resourceType === "journal-article" && data.container ? escapeTex(data.container) : null);
  if (data.resourceType !== "journal-article" && data.container) add("booktitle", escapeTex(data.container));
  add("volume", data.volume);
  add("number", data.issue);
  add("pages", data.pages ? data.pages.replace(/[-–]/, "--") : null);
  add("publisher", data.publisher ? escapeTex(data.publisher) : null);
  add("doi", data.doi);
  add("url", data.url);

  return `@${bibType(data)}{${bibtexKey(data, index)},\n${fields.join("\n")}\n}`;
}

export function toBibtex(items: CitationData[]): string {
  return items
    .map((item, i) => toBibtexEntry(item, i))
    .join("\n\n")
    .concat("\n");
}
