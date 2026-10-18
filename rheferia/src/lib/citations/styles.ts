/**
 * Citation style formatters (reference entry + in-text) for APA 7, MLA 9,
 * Chicago 17, IEEE, Vancouver, and Harvard.
 *
 * Rules implemented from the published style guides. Missing metadata is
 * omitted per style convention (or "n.d." where the style mandates it),
 * never invented. Numbered styles render in-text as [n]; n is the
 * caller-assigned position, passed in at format time.
 */

import type { CitationData, CitationStyle, FormattedCitation, MissingField } from "./types";
import { findMissingFields } from "./types";

/* ------------------------------ name utilities ------------------------------ */

function initials(given: string | undefined): string {
  if (!given) return "";
  // "Jean-Pierre van der Berg" -> "J.-P. v. d. B." (IEEE-style, with periods)
  return given
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => (part.includes(".") ? part : `${part[0]}.`))
    .join(" ");
}

/** IEEE/Vancouver: "J. P. Smith" -> "J P Smith" (no periods) */
function initialsNoPeriods(given: string | undefined): string {
  return initials(given)
    .replace(/\.\s*/g, "")
    .replace(/-\s*/g, "-")
    .trim();
}

function lastFirst(given: string | undefined, family: string | undefined, raw: string): string {
  if (family && given) return `${family}, ${given}`;
  if (family) return family;
  return raw;
}

/* ---------------------------------- APA 7 ----------------------------------- */

function apaAuthors(data: CitationData): string {
  const list = data.authors.map((a) => {
    if (a.isOrganization || (!a.family && !a.given)) return a.raw;
    if (!a.family) return a.given ?? a.raw;
    const given = a.given
      ? a.given
          .split(/[\s-]+/)
          .filter(Boolean)
          .map((word) => `${word[0]}.`)
          .join(" ")
      : "";
    return given ? `${a.family}, ${given}` : a.family;
  });
  if (list.length === 0) return "";
  if (list.length === 1) return list[0]!;
  if (list.length === 2) return `${list[0]}, & ${list[1]}`;
  return `${list.slice(0, -1).join(", ")}, & ${list[list.length - 1]}`;
}

function apa(data: CitationData, _n: number): FormattedCitation {
  const authors = apaAuthors(data) || (data.title ? "" : "Anonymous");
  const year = data.year != null ? String(data.year) : "n.d.";
  const parts: string[] = [];
  if (authors) parts.push(`${authors} (${year}).`);
  else parts.push(`(${year}).`);

  const title = sentenceCase(data.title);
  const doiUrl = data.doi ? `https://doi.org/${data.doi}` : data.url;

  if (data.resourceType === "journal-article" && data.container) {
    const vol = data.volume ? `*${data.volume}*` : "";
    const issue = data.issue ? `(${data.issue})` : "";
    const pages = data.pages ? `, ${data.pages}` : "";
    const tail = [vol, issue].filter(Boolean).join("");
    parts.push(`${title}.`);
    parts.push(
      `*${data.container}*${tail ? `, ${tail}` : ""}${pages}.`,
    );
  } else if (data.resourceType === "book") {
    parts.push(`*${title}*.`);
    if (data.edition) parts.push(`(${data.edition} ed.).`);
    if (data.publisher) parts.push(`${data.publisher}.`);
  } else {
    parts.push(`${title}.`);
    if (data.container) parts.push(`*${data.container}*.`);
    if (data.publisher) parts.push(`${data.publisher}.`);
  }
  if (doiUrl) parts.push(doiUrl);

  const ref = parts.join(" ").replace(/\s+\./g, ".").replace(/\.\./g, ".");

  const first = data.authors[0]?.family ?? (data.authors[0]?.raw ?? "Anonymous");
  if (data.authors.length >= 3) {
    return finish(data, "apa", ref, `(${first} et al., ${year})`);
  }
  if (data.authors.length === 2 && data.authors[1]?.family) {
    return finish(data, "apa", ref, `(${first} & ${data.authors[1].family}, ${year})`);
  }
  return finish(data, "apa", ref, `(${first}, ${year})`);
}

/* ---------------------------------- MLA 9 ----------------------------------- */

function mla(data: CitationData, n: number): FormattedCitation {
  void n;
  const first = data.authors[0];
  const head = first
    ? lastFirst(first.given, first.family, first.raw)
    : "";
  const parts: string[] = [];
  if (head) {
    parts.push(data.authors.length >= 2 ? `${head}, et al.` : `${head}.`);
  }
  // MLA quotes titles of articles; books/standalone works are italic.
  const title = data.title;
  const standalone = data.resourceType === "book" || data.resourceType === "report" || data.resourceType === "thesis";
  const titlePiece = standalone ? `*${title}.*` : `"${title}."`;
  parts.push(titlePiece);

  if (data.container) parts.push(`*${data.container}*${data.volume ? `, vol. ${data.volume}` : ""}${data.issue ? `, no. ${data.issue}` : ""},`);
  if (data.year != null) parts.push(`${data.year}`);
  if (data.pages) parts.push(`pp. ${data.pages.replace(/^p\.\s*/i, "")}.`);
  const doiUrl = data.doi ? `https://doi.org/${data.doi}` : data.url;
  if (doiUrl && data.container) parts.push(doiUrl + ".");

  const ref = parts.filter(Boolean).join(" ").replace(/\s+,/g, ",").replace(/\s{2,}/g, " ");

  const pageHint = data.pages ? ` ${data.pages.split(/[-–]/)[0]}` : "";
  const author = first?.family ?? first?.raw ?? title.split(" ").slice(0, 3).join(" ");
  return finish(data, "mla", ref, `(${author}${pageHint})`);
}

/* ------------------------------- Chicago 17 -------------------------------- */

function chicagoAuthors(data: CitationData): string {
  const names = data.authors.map((a, i) => {
    const base = a.family && a.given ? `${a.given} ${a.family}` : a.raw;
    return i === 0 && a.family && a.given ? `${a.family}, ${a.given}` : base;
  });
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]}, and ${names[1]}`;
  if (names.length === 3) return `${names.join(", ")}`.replace(/, ([^,]*)$/, ", and $1");
  return `${names[0]} et al.`;
}

function chicago(data: CitationData, _n: number): FormattedCitation {
  const authors = chicagoAuthors(data);
  const year = data.year != null ? String(data.year) : "n.d.";
  const doiUrl = data.doi ? `https://doi.org/${data.doi}` : data.url;
  const parts: string[] = [];
  if (authors) parts.push(`${authors}.`);
  parts.push(`"${data.title}."`);

  if (data.container) {
    const bits = [`*${data.container}*`];
    if (data.volume) bits.push(`vol. ${data.volume}`);
    if (data.issue) bits.push(`no. ${data.issue}`);
    const line = bits.join(", ");
    parts.push(`${line} (${year})${data.pages ? `: ${data.pages}` : ""}.`);
  } else {
    parts.push(`${data.publisher ?? ""} ${year}.`.trim());
  }
  if (doiUrl) parts.push(doiUrl + ".");

  const ref = parts.filter(Boolean).join(" ").replace(/\s{2,}/g, " ");
  const first = data.authors[0]?.family ?? data.authors[0]?.raw ?? "Anon.";
  return finish(data, "chicago", ref, `(${first} ${year})`);
}

/* ----------------------------------- IEEE ----------------------------------- */

function ieee(data: CitationData, n: number): FormattedCitation {
  const names = data.authors.map((a) => {
    if (a.isOrganization || (!a.family && !a.given)) return a.raw;
    const init = initials(a.given);
    return a.family ? `${init} ${a.family}`.trim() : init;
  });
  const shown = names.length > 6 ? `${names.slice(0, 6).join(", ")}, et al.` : names.join(", ");

  const parts: string[] = [`[${n}]`];
  if (shown) parts.push(`${shown},`);
  parts.push(`"${data.title},"`);
  if (data.container) {
    const vol = data.volume ? `vol. ${data.volume}` : "";
    const no = data.issue ? `no. ${data.issue}` : "";
    const pp = data.pages ? `pp. ${data.pages}` : "";
    const tail = [vol, no, pp].filter(Boolean).join(", ");
    parts.push(`*${data.container}*${tail ? `, ${tail}` : ""}, ${data.year ?? "n.d."}.`);
  } else {
    const tail = [data.publisher, data.year != null ? String(data.year) : null]
      .filter(Boolean)
      .join(", ");
    if (tail) parts.push(`${tail}.`);
  }
  if (data.doi) parts.push(`doi: ${data.doi}.`);

  const ref = parts.filter(Boolean).join(" ").replace(/\s{2,}/g, " ");
  return finish(data, "ieee", ref, `[${n}]`);
}

/* --------------------------------- Vancouver -------------------------------- */

function vancouver(data: CitationData, n: number): FormattedCitation {
  const names = data.authors.map((a) => {
    if (a.isOrganization || (!a.family && !a.given)) return a.raw;
    const init = initialsNoPeriods(a.given);
    return a.family ? `${a.family} ${init}`.trim() : init;
  });
  const shown = names.length > 6 ? `${names.slice(0, 6).join(", ")}, et al.` : names.join(", ");

  const parts: string[] = [`[${n}]`];
  if (shown) parts.push(`${shown.replace(/\.$/, "")}.`);
  parts.push(`${data.title}.`);
  if (data.container) {
    const segs = [data.container, data.year != null ? String(data.year) : ""].filter(Boolean);
    let line = segs.join(". ");
    if (data.volume) {
      line += `;${data.volume}`;
      if (data.issue) line += `(${data.issue})`;
    }
    if (data.pages) line += `:${data.pages}`;
    parts.push(`${line}.`);
  } else if (data.publisher) {
    parts.push(`${data.publisher}${data.year != null ? `; ${data.year}` : ""}.`);
  }
  if (data.doi) parts.push(`doi:${data.doi}.`);

  const ref = parts.filter(Boolean).join(" ").replace(/\s{2,}/g, " ");
  return finish(data, "vancouver", ref, `[${n}]`);
}

/* --------------------------------- Harvard ---------------------------------- */

function harvardAuthors(data: CitationData): string {
  const list = data.authors.map((a) => {
    if (a.isOrganization || (!a.family && !a.given)) return a.raw;
    if (!a.family) return a.given ?? a.raw;
    const init = a.given
      ? ` ${a.given.split(/[\s-]+/).filter(Boolean).map((word) => `${word[0]}.`).join(" ")}`
      : "";
    return `${a.family},${init}`.replace(/,$/, "");
  });
  if (list.length === 0) return "";
  if (list.length === 1) return list[0]!;
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  if (list.length === 3) return `${list[0]}, ${list[1]} and ${list[2]}`;
  return `${list[0]} et al.`;
}

function harvard(data: CitationData, _n: number): FormattedCitation {
  const authors = harvardAuthors(data);
  const year = data.year != null ? String(data.year) : "no date";
  const parts: string[] = [];
  if (authors) parts.push(`${authors} (${year})`);
  // Harvard sentence-cases article/chapter titles like APA.
  const isArticle =
    data.resourceType === "journal-article" ||
    data.resourceType === "book-chapter" ||
    data.resourceType === "conference-paper";
  parts.push(`'${isArticle ? sentenceCase(data.title) : data.title}',`);
  if (data.container) {
    const vol = data.volume ? `, vol. ${data.volume}` : "";
    const issue = data.issue ? `(${data.issue})` : "";
    const pp = data.pages ? `, pp. ${data.pages}` : "";
    parts.push(`*${data.container}*${vol}${issue}${pp}.`);
  } else if (data.publisher) {
    parts.push(`${data.publisher}.`);
  }
  if (data.doi) parts.push(`doi: ${data.doi}.`);

  const ref = parts.filter(Boolean).join(" ").replace(/\s{2,}/g, " ");
  const first = data.authors[0]?.family ?? data.authors[0]?.raw ?? "Anon.";
  return finish(data, "harvard", ref, `(${first}, ${year})`);
}

/* --------------------------------- dispatch --------------------------------- */

/**
 * Sentence case for APA. If the title looks like Title Case (most words
 * capitalized), we lowercase every word EXCEPT: the first word, words
 * after a colon, ALL-CAPS acronyms, and words in a proper-noun keep list
 * (countries, languages, institutions, common brand names). An obscure
 * proper noun may get lowercased — that is why citations with missing
 * fields are flagged for review, and wrongly lowercasing is safer than
 * randomly keeping Title Case.
 */
const PROPER_NOUNS = new Set([
  "Africa","African","America","American","Asia","Asian","Atlantic","Britain",
  "British","Canada","Canadian","China","Chinese","Congo","Denmark","Danish",
  "Dutch","England","English","Europe","European","Finland","Finnish","France",
  "French","German","Germany","Ghana","Greece","Greek","India","Indian",
  "Indonesia","Iran","Iraq","Ireland","Irish","Israel","Italy","Italian",
  "Jamaica","Japan","Japanese","Kenya","Korea","Korean","Latin","Malaysia",
  "Mexico","Mexican","Netherlands","Nigeria","Norway","Norwegian","Pacific",
  "Pakistan","Philippine","Philippines","Filipino","Poland","Polish","Portugal",
  "Russia","Russian","Rwanda","Scotland","Scottish","Singapore","Spain",
  "Spanish","Sweden","Swedish","Swiss","Switzerland","Taiwan","Tanzania",
  "Thailand","Thai","Turkey","Turkish","Uganda","Vietnam","Wales","Welsh",
  "Facebook","Google","Microsoft","Amazon","YouTube","Wikipedia","ChatGPT",
  "Internet","Web","COVID","HIV","AIDS","DNA","RNA","NASA","NATO","UNESCO",
  "WHO","UN","OECD","EU","MIT","Oxford","Cambridge","Harvard","Yale","Stanford",
  "Baylor","Lund","Tokyo","Beijing","Shanghai","Manila","Quezon","Nairobi",
  "London","Paris","Berlin","Boston","Chicago","Toronto","Sydney","Melbourne",
  "Mathematics","Mathematica",
]);

function isTitleCase(title: string): boolean {
  const words = title.split(" ").filter((w) => /[A-Za-z]/.test(w));
  if (words.length < 2) return false;
  const caps = words.filter((w) => /^[A-Z]/.test(w)).length;
  return caps / words.length >= 0.7;
}

function sentenceCase(title: string): string {
  if (!isTitleCase(title)) {
    // Already sentence case or unusual casing: keep as provided.
    return title;
  }
  const out: string[] = [];
  let afterColon = false;
  const words = title.split(" ");
  for (let index = 0; index < words.length; index++) {
    const token = words[index]!;
    const bare = token.replace(/[^\w-]/g, "");
    if (!/[A-Za-z]/.test(bare) || /^\d/.test(bare)) {
      out.push(token);
      afterColon = token.endsWith(":");
      continue;
    }
    if (index === 0 || afterColon) {
      out.push(token.charAt(0).toUpperCase() + token.slice(1));
    } else if (/^[A-Z]{2,}$/.test(bare) || PROPER_NOUNS.has(bare)) {
      out.push(token); // acronym or known proper noun
    } else {
      out.push(token.charAt(0).toLowerCase() + token.slice(1));
    }
    afterColon = token.endsWith(":");
  }
  return out.join(" ");
}

function finish(
  data: CitationData,
  style: CitationStyle,
  reference: string,
  inText: string,
): FormattedCitation {
  return {
    reference: reference.replace(/\s+\./g, ".").replace(/\s{2,}/g, " ").trim(),
    inText,
    missingFields: findMissingFields(data),
    style,
  };
}

export function formatCitation(
  data: CitationData,
  style: CitationStyle,
  position = 1,
): FormattedCitation {
  switch (style) {
    case "apa":
      return apa(data, position);
    case "mla":
      return mla(data, position);
    case "chicago":
      return chicago(data, position);
    case "ieee":
      return ieee(data, position);
    case "vancouver":
      return vancouver(data, position);
    case "harvard":
      return harvard(data, position);
  }
}

export { type MissingField };
