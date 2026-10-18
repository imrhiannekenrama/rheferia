"use client";

/**
 * The in-browser tool workbench. Files selected here are processed on the
 * user's device with pdf-lib / pdf.js / JSZip — nothing is uploaded. Each
 * tool states exactly what it does and reports failures with the engine's
 * honest messages.
 */

import { useRef, useState } from "react";
import {
  addPageNumbers,
  addWatermark,
  extractPages,
  imagesToPdf,
  mergePdfs,
  reorderPages,
  rotatePdf,
  splitPdf,
  textToPdf,
  type ImageKind,
  type NumberPosition,
} from "@/lib/conversions/pdf-ops";
import { extractPdfText, pdfTextToOutput } from "@/lib/conversions/pdf-text";
import { renderPdfPages, type ImageFormat } from "@/lib/conversions/pdf-images";
import { loadPdf } from "@/lib/conversions/pdf-ops";
import { parsePageRange } from "@/lib/conversions/page-range";
import type { ToolSpec } from "@/lib/conversions/tool-registry";

interface ResultFile {
  name: string;
  blob: Blob;
}

function bytesToBlob(bytes: Uint8Array, mime: string): Blob {
  return new Blob([new Uint8Array(bytes)], { type: mime });
}

const POSITIONS: { value: NumberPosition; label: string }[] = [
  { value: "bottom-center", label: "Bottom center" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "top-center", label: "Top center" },
  { value: "top-right", label: "Top right" },
  { value: "top-left", label: "Top left" },
];

export function ToolWorkbench({ tool }: { tool: ToolSpec }) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ResultFile[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  // Shared options state (only the relevant fields are shown per tool)
  const [pageSpec, setPageSpec] = useState("");
  const [angle, setAngle] = useState("90");
  const [position, setPosition] = useState<NumberPosition>("bottom-center");
  const [startAt, setStartAt] = useState(1);
  const [format, setFormat] = useState<"n" | "n-of-m" | "page-n">("n");
  const [wmText, setWmText] = useState("CONFIDENTIAL");
  const [wmOpacity, setWmOpacity] = useState(0.3);
  const [wmAngle, setWmAngle] = useState(45);
  const [wmPosition, setWmPosition] = useState<"center" | "diagonal">("diagonal");
  const [imgFormat, setImgFormat] = useState<ImageFormat>("png");
  const [imgScale, setImgScale] = useState(1.5);
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfBody, setPdfBody] = useState("");

  const multiple = tool.slug === "merge-pdf" || tool.slug === "image-to-pdf";
  const wantsFile = tool.slug !== "text-to-pdf";
  const inputRef = useRef<HTMLInputElement>(null);

  function resetOutput() {
    setError(null);
    setNotice(null);
    setResults([]);
  }

  async function run() {
    resetOutput();
    setBusy(true);
    try {
      const out = await dispatch();
      setResults(out);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong while processing.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function fileBytes(file: File): Promise<Uint8Array> {
    return new Uint8Array(await file.arrayBuffer());
  }

  async function zipFiles(entries: ResultFile[], name: string): Promise<ResultFile[]> {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    for (const file of entries) zip.file(file.name, file.blob);
    const blob = await zip.generateAsync({ type: "blob" });
    return [{ name, blob }];
  }

  async function dispatch(): Promise<ResultFile[]> {
    switch (tool.slug) {
      case "merge-pdf": {
        const bytes = await Promise.all(files.map(fileBytes));
        const merged = await mergePdfs(bytes);
        return [{ name: "merged.pdf", blob: bytesToBlob(merged, "application/pdf") }];
      }

      case "extract-pdf-pages": {
        const bytes = await fileBytes(files[0]!);
        const out = await extractPages(bytes, pageSpec);
        return [{ name: "selected-pages.pdf", blob: bytesToBlob(out, "application/pdf") }];
      }

      case "reorder-pdf-pages": {
        const bytes = await fileBytes(files[0]!);
        const out = await reorderPages(bytes, pageSpec);
        return [{ name: "reordered.pdf", blob: bytesToBlob(out, "application/pdf") }];
      }

      case "rotate-pdf": {
        const bytes = await fileBytes(files[0]!);
        const out = await rotatePdf(bytes, pageSpec, angle);
        return [{ name: "rotated.pdf", blob: bytesToBlob(out, "application/pdf") }];
      }

      case "split-pdf": {
        const file = files[0]!;
        const bytes = await fileBytes(file);
        const baseName = (file.name.replace(/\.pdf$/i, "") || "document").slice(0, 40);
        const { files: parts, unmatchedPages } = await splitPdf(bytes, pageSpec, baseName);
        const entries: ResultFile[] = parts.map((part) => ({
          name: part.name,
          blob: bytesToBlob(part.bytes, "application/pdf"),
        }));
        if (unmatchedPages > 0) {
          setNotice(
            `${unmatchedPages} page${unmatchedPages === 1 ? "" : "s"} of this document ${
              unmatchedPages === 1 ? "was" : "were"
            } not covered by your ranges and are not in any output file.`,
          );
        }
        if (entries.length === 1) return entries;
        return zipFiles(entries, `${baseName}-split.zip`);
      }

      case "add-page-numbers": {
        const bytes = await fileBytes(files[0]!);
        const out = await addPageNumbers(bytes, { position, startAt, spec: pageSpec, format });
        return [{ name: "numbered.pdf", blob: bytesToBlob(out, "application/pdf") }];
      }

      case "watermark-pdf": {
        const bytes = await fileBytes(files[0]!);
        const out = await addWatermark(bytes, {
          text: wmText,
          opacity: wmOpacity,
          angle: wmAngle,
          position: wmPosition,
          spec: pageSpec,
          color: [0.5, 0.5, 0.5],
        });
        return [{ name: "watermarked.pdf", blob: bytesToBlob(out, "application/pdf") }];
      }

      case "text-to-pdf": {
        const out = await textToPdf(pdfTitle, pdfBody);
        return [{ name: "document.pdf", blob: bytesToBlob(out, "application/pdf") }];
      }

      case "image-to-pdf": {
        const images: { bytes: Uint8Array; kind: ImageKind }[] = [];
        for (const file of files) {
          const kind: ImageKind = file.type === "image/png" ? "png" : "jpg";
          images.push({ bytes: await fileBytes(file), kind });
        }
        const out = await imagesToPdf(images);
        return [{ name: "images.pdf", blob: bytesToBlob(out, "application/pdf") }];
      }

      case "pdf-to-text": {
        const bytes = await fileBytes(files[0]!);
        const result = await extractPdfText(bytes);
        if (result.emptyPages.length > 0) {
          setNotice(
            `${result.emptyPages.length} page${
              result.emptyPages.length === 1 ? "" : "s"
            } (${result.emptyPages.join(", ")}) ${
              result.emptyPages.length === 1 ? "has" : "have"
            } no embedded text — ${
              result.emptyPages.length === 1 ? "it is likely" : "they are likely"
            } scanned images. Extracting text from ${
              result.emptyPages.length === 1 ? "it" : "them"
            } requires OCR, which this tool does not do.`,
          );
        }
        const text = pdfTextToOutput(result);
        return [{ name: "extracted-text.txt", blob: new Blob([text], { type: "text/plain" }) }];
      }

      case "pdf-to-images": {
        const bytes = await fileBytes(files[0]!);
        const doc = await loadPdf(bytes);
        const pageCount = doc.getPageCount();
        const targets =
          pageSpec.trim().length > 0 ? parsePageRange(pageSpec, pageCount).map((i) => i + 1) : Array.from({ length: pageCount }, (_, i) => i + 1);
        const rendered = await renderPdfPages(bytes, targets, imgScale, imgFormat);
        const ext = imgFormat === "png" ? "png" : "jpg";
        const entries: ResultFile[] = rendered.map((page) => ({
          name: `page-${String(page.page).padStart(2, "0")}.${ext}`,
          blob: new Blob([new Uint8Array(page.bytes)], {
            type: imgFormat === "png" ? "image/png" : "image/jpeg",
          }),
        }));
        if (entries.length === 1) return entries;
        return zipFiles(entries, `pages-${ext}.zip`);
      }

      default:
        throw new Error("This tool is not available in the browser workbench.");
    }
  }

  const canRun =
    !busy &&
    (tool.slug === "text-to-pdf"
      ? pdfBody.trim().length > 0
      : files.length > 0 && (multiple || files.length === 1)) &&
    (tool.slug !== "split-pdf" || pageSpec.trim().length > 0);

  return (
    <div className="mt-8 space-y-6">
      {/* File selection */}
      {wantsFile && (
        <section className="rounded-lg border bg-card p-5">
          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-input px-4 py-8 text-center transition-colors hover:border-primary/50"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const dropped = Array.from(e.dataTransfer.files);
              setFiles(multiple ? dropped : dropped.slice(0, 1));
            }}
          >
            <p className="text-sm font-medium">
              {multiple ? "Select or drop files" : "Select or drop a file"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Accepted: {tool.inputs.join(", ")} · {multiple ? "multiple files" : "one file"}
            </p>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept={tool.inputs.join(",")}
              multiple={multiple}
              onChange={(e) => {
                const selected = Array.from(e.target.files ?? []);
                setFiles(multiple ? selected : selected.slice(0, 1));
                resetOutput();
              }}
            />
          </div>
          {files.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center gap-2">
                  <span className="text-muted-foreground">{index + 1}.</span>
                  <span className="truncate">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(0)} KB
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Tool options */}
      <section className="rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold">Options</h2>

        {wantsPageSpec(tool.slug) && (
          <label className="mt-3 block text-sm">
            <span className="text-muted-foreground">
              {tool.slug === "reorder-pdf-pages"
                ? "New page order (unlisted pages are dropped)"
                : tool.slug === "split-pdf"
                  ? "Ranges to split into, separated by ;"
                  : tool.slug === "pdf-to-images"
                    ? "Pages to render (empty = all pages)"
                    : "Pages (empty = all pages)"}
            </span>
            <input
              value={pageSpec}
              onChange={(e) => setPageSpec(e.target.value)}
              placeholder={
                tool.slug === "split-pdf"
                  ? "1-3; 4-6; 7-"
                  : tool.slug === "reorder-pdf-pages"
                    ? "3, 1, 2"
                    : "1-3, 5"
              }
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        )}

        {tool.slug === "rotate-pdf" && (
          <div className="mt-3">
            <span className="text-sm text-muted-foreground">Rotation</span>
            <div className="mt-1 flex gap-2">
              {["90", "180", "270"].map((deg) => (
                <button
                  key={deg}
                  type="button"
                  onClick={() => setAngle(deg)}
                  className={`rounded-md border px-4 py-1.5 text-sm ${
                    angle === deg ? "border-primary bg-primary/10" : "border-input"
                  }`}
                >
                  {deg}°
                </button>
              ))}
            </div>
          </div>
        )}

        {tool.slug === "add-page-numbers" && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-muted-foreground">Position</span>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as NumberPosition)}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
              >
                {POSITIONS.map((pos) => (
                  <option key={pos.value} value={pos.value}>
                    {pos.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Start numbering at</span>
              <input
                type="number"
                min={1}
                value={startAt}
                onChange={(e) => setStartAt(Math.max(1, Number(e.target.value) || 1))}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-muted-foreground">Label format</span>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as typeof format)}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
              >
                <option value="n">1, 2, 3</option>
                <option value="n-of-m">1 of 12</option>
                <option value="page-n">Page 1</option>
              </select>
            </label>
          </div>
        )}

        {tool.slug === "watermark-pdf" && (
          <div className="mt-3 space-y-3">
            <label className="block text-sm">
              <span className="text-muted-foreground">Watermark text</span>
              <input
                value={wmText}
                onChange={(e) => setWmText(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-muted-foreground">Opacity: {wmOpacity.toFixed(2)}</span>
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={wmOpacity}
                  onChange={(e) => setWmOpacity(Number(e.target.value))}
                  className="mt-2 w-full"
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground">Angle: {wmAngle}°</span>
                <input
                  type="range"
                  min={-90}
                  max={90}
                  step={5}
                  value={wmAngle}
                  onChange={(e) => setWmAngle(Number(e.target.value))}
                  className="mt-2 w-full"
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground">Placement</span>
                <select
                  value={wmPosition}
                  onChange={(e) => setWmPosition(e.target.value as typeof wmPosition)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                >
                  <option value="diagonal">Diagonal across the page</option>
                  <option value="center">Horizontal, centered</option>
                </select>
              </label>
            </div>
          </div>
        )}

        {tool.slug === "pdf-to-images" && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-muted-foreground">Image format</span>
              <select
                value={imgFormat}
                onChange={(e) => setImgFormat(e.target.value as ImageFormat)}
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
              >
                <option value="png">PNG (lossless)</option>
                <option value="jpeg">JPG (smaller)</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">
                Resolution: {imgScale.toFixed(1)}× ({Math.round(72 * imgScale)} DPI)
              </span>
              <input
                type="range"
                min={0.5}
                max={3}
                step={0.25}
                value={imgScale}
                onChange={(e) => setImgScale(Number(e.target.value))}
                className="mt-2 w-full"
              />
            </label>
          </div>
        )}

        {tool.slug === "text-to-pdf" && (
          <div className="mt-3 space-y-3">
            <label className="block text-sm">
              <span className="text-muted-foreground">Title (optional)</span>
              <input
                value={pdfTitle}
                onChange={(e) => setPdfTitle(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Text (uses Helvetica; Latin characters)</span>
              <textarea
                value={pdfBody}
                onChange={(e) => setPdfBody(e.target.value)}
                rows={8}
                placeholder="Paste or type your text…"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>
        )}
      </section>

      {/* Run */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={!canRun}
          className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Processing…" : `Run ${tool.name}`}
        </button>
        <span className="text-xs text-muted-foreground">
          Runs on your device — your file is never uploaded.
        </span>
      </div>

      {/* Honest notices and errors */}
      {notice && (
        <p role="status" className="rounded-md border border-dashed border-amber-500/50 bg-amber-500/5 px-3 py-2 text-sm">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Results */}
      {results.length > 0 && !busy && (
        <section className="rounded-lg border bg-card p-5" aria-label="Result files">
          <h2 className="text-sm font-semibold">Ready</h2>
          <ul className="mt-2 space-y-2">
            {results.map((result) => (
              <li key={result.name} className="flex items-center justify-between gap-3">
                <span className="truncate text-sm">{result.name}</span>
                <a
                  href={URL.createObjectURL(result.blob)}
                  download={result.name}
                  className="shrink-0 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function wantsPageSpec(slug: string): boolean {
  return [
    "extract-pdf-pages",
    "reorder-pdf-pages",
    "rotate-pdf",
    "split-pdf",
    "add-page-numbers",
    "watermark-pdf",
    "pdf-to-images",
  ].includes(slug);
}
