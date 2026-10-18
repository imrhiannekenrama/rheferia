"use client";

/**
 * Cloud converter form. Only shown when the provider is configured; the
 * server component passes honest limits. The file goes to our /api/convert
 * route, which forwards it to CloudConvert; the response carries real
 * before/after sizes.
 */

import { useState } from "react";
import type { ToolSpec } from "@/lib/conversions/tool-registry";

export function CloudConverterForm({
  tool,
  limits,
}: {
  tool: ToolSpec;
  limits: { maxUploadMiB: number; dailyConversions: number; retentionHours: number };
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const [ocr, setOcr] = useState(false);
  const [inputSize, setInputSize] = useState<number | null>(null);
  const [outputSize, setOutputSize] = useState<number | null>(null);

  async function convert() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setInputSize(null);
    setOutputSize(null);
    setProgress("Uploading to the converter…");
    try {
      const body = new FormData();
      body.append("file", file);
      if ((tool.slug === "pdf-to-word" || tool.slug === "pdf-to-excel") && ocr) body.append("ocr", "true");
      if (tool.slug === "compress-pdf") body.append("level", "strong");

      setProgress("Converting (this can take a minute for large files)…");
      const response = await fetch(`/api/convert/${tool.slug}`, { method: "POST", body });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error?.message ?? `The conversion failed (${response.status}).`);
        return;
      }

      setInputSize(Number(response.headers.get("X-Conversion-Input-Size") ?? file.size));
      const blob = await response.blob();
      const outSize = Number(response.headers.get("X-Conversion-Output-Size") ?? blob.size);
      setOutputSize(outSize);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = response.headers
        .get("Content-Disposition")
        ?.match(/filename="([^"]+)"/)?.[1] ?? `converted.${tool.output.replace(/^\./, "")}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("The network request failed. Check your connection and try again.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <section className="rounded-lg border bg-card p-5">
        <label className="block text-sm font-medium" htmlFor="cloud-file">
          Select your file ({tool.inputs.join(", ")}, up to {limits.maxUploadMiB} MiB)
        </label>
        <input
          id="cloud-file"
          type="file"
          accept={tool.inputs.join(",")}
          className="mt-3 w-full text-sm"
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            if (selected && selected.size > limits.maxUploadMiB * 1024 * 1024) {
              setError(
                `That file is ${(selected.size / 1024 / 1024).toFixed(1)} MiB; the limit is ${limits.maxUploadMiB} MiB.`,
              );
              return;
            }
            setError(null);
            setFile(selected);
          }}
        />
        {(tool.slug === "pdf-to-word" || tool.slug === "pdf-to-excel") && (
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ocr}
              onChange={(e) => setOcr(e.target.checked)}
              className="h-4 w-4"
            />
            <span>
              Scanned PDF? Run OCR (slower). Only needed when the PDF is images
              of text rather than embedded text.
            </span>
          </label>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          This file is sent to the configured conversion provider, converted,
          and returned to you. Converted copies on the provider expire after{" "}
          {limits.retentionHours} hours. Limit: {limits.dailyConversions}{" "}
          {limits.dailyConversions === 1 ? "conversion" : "conversions"} per day per visitor.
        </p>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={convert}
          disabled={busy || !file}
          className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Converting…" : `Convert to ${tool.output}`}
        </button>
        {progress && <span className="text-xs text-muted-foreground">{progress}</span>}
      </div>

      {tool.slug === "compress-pdf" && inputSize != null && outputSize != null && (
        <p role="status" className="rounded-md border bg-card px-3 py-2 text-sm">
          {outputSize < inputSize
            ? `Reduced from ${(inputSize / 1024).toFixed(0)} KB to ${(outputSize / 1024).toFixed(0)} KB (${Math.round((1 - outputSize / inputSize) * 100)}% smaller).`
            : "This file was already well optimized — the converter could not make it smaller, and the output is not meaningfully reduced."}
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function CloudNotConfigured() {
  return (
    <div className="mt-8 rounded-lg border border-dashed bg-card p-6 text-sm">
      <p className="font-medium">Cloud conversion is not configured on this deployment.</p>
      <p className="mt-2 text-muted-foreground">
        To enable PDF→Word, Word→PDF, Excel→PDF, PowerPoint→PDF, and cloud
        compression, the operator sets <code className="font-mono text-xs">CLOUDCONVERT_API_KEY</code>{" "}
        in the environment (see docs/PROVIDER-SETUP.md). Meanwhile, every
        browser tool — merge, split, extract, reorder, rotate, page numbers,
        watermark, images↔PDF, and text extraction — works without any
        provider and never uploads your files.
      </p>
    </div>
  );
}
