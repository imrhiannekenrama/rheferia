/**
 * RIS serializer. Tag mapping follows the standard RIS 1.0 layout used
 * by EndNote/Zotero/Mendeley importers.
 */

import type { CitationData } from "./types";

function risType(data: CitationData): string {
  switch (data.resourceType) {
    case "journal-article":
      return "JOUR";
    case "book":
      return "BOOK";
    case "book-chapter":
      return "CHAP";
    case "conference-paper":
      return "CONF";
    case "thesis":
      return "THES";
    case "report":
      return "RPRT";
    case "dataset":
      return "DATA";
    case "webpage":
      return "ELEC";
    default:
      return "GEN";
  }
}

export function toRis(items: CitationData[]): string {
  const chunks: string[] = [];
  for (const data of items) {
    const lines: string[] = [`TY  - ${risType(data)}`];
    const push = (tag: string, value?: string | null) => {
      if (value) lines.push(`${tag}  - ${value}`);
    };
    for (const author of data.authors) {
      push("AU", author.family && author.given ? `${author.family}, ${author.given}` : author.raw);
    }
    push("TI", data.title);
    push("T2", data.container);
    if (data.year != null) push("PY", String(data.year));
    push("VL", data.volume);
    push("IS", data.issue);
    if (data.pages) {
      const [start, end] = data.pages.split(/[-–]/);
      push("SP", start?.trim());
      push("EP", end?.trim() ?? start?.trim());
    }
    push("PB", data.publisher);
    push("DO", data.doi);
    push("UR", data.url);
    push("ID", data.recordId);
    lines.push("ER  - ");
    chunks.push(lines.join("\n"));
  }
  return chunks.join("\n") + (chunks.length ? "\n" : "");
}
