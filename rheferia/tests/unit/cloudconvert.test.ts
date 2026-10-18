import { describe, expect, it } from "vitest";
import { buildJobBody, jobSpecFor } from "@/lib/conversions/cloudconvert";

describe("cloud tool job graphs", () => {
  it("builds an import/convert/export pipeline for PDF → Word", () => {
    const spec = jobSpecFor("pdf-to-word");
    const body = buildJobBody(spec);
    const tasks = body.tasks as Record<string, Record<string, unknown>>;
    expect(tasks["upload-pdf"]).toEqual({ operation: "import/upload" });
    expect(tasks["to-docx"]).toMatchObject({
      operation: "convert",
      input_format: "pdf",
      output_format: "docx",
      input: ["upload-pdf"],
    });
    expect(tasks["export-result"]).toEqual({
      operation: "export/url",
      input: ["to-docx"],
      archive: false,
    });
  });

  it("adds OCR args only when requested", () => {
    const spec = jobSpecFor("pdf-to-word", { ocr: "true", ocrEngine: "tesseract" });
    const body = buildJobBody(spec) as { tasks: Record<string, Record<string, unknown>> };
    expect(body.tasks["to-docx"]!).toMatchObject({ ocr: true, ocr_engine: "tesseract" });

    const plain = jobSpecFor("pdf-to-word");
    const plainBody = buildJobBody(plain) as { tasks: Record<string, Record<string, unknown>> };
    expect(plainBody.tasks["to-docx"]!).not.toHaveProperty("ocr");
  });

  it("uses the qpdf engine for compression", () => {
    const spec = jobSpecFor("compress-pdf");
    const body = buildJobBody(spec) as { tasks: Record<string, Record<string, unknown>> };
    expect(body.tasks["optimize-pdf"]!).toMatchObject({
      operation: "convert",
      engine: "qpdf",
      input_format: "pdf",
      output_format: "pdf",
    });
  });

  it("wires PDF → Excel with OCR passthrough", () => {
    const spec = jobSpecFor("pdf-to-excel", { ocr: "true" });
    const body = buildJobBody(spec) as { tasks: Record<string, Record<string, unknown>> };
    expect(body.tasks["to-xlsx"]!).toMatchObject({
      operation: "convert",
      input_format: "pdf",
      output_format: "xlsx",
      ocr: true,
    });
  });

  it("wires office conversions with the right formats", () => {
    for (const [tool, from, to] of [
      ["word-to-pdf", "docx", "pdf"],
      ["excel-to-pdf", "xlsx", "pdf"],
      ["powerpoint-to-pdf", "pptx", "pdf"],
    ] as const) {
      const spec = jobSpecFor(tool);
      const body = buildJobBody(spec) as { tasks: Record<string, Record<string, unknown>> };
      const convert = body.tasks[spec.convertTaskName]!;
      expect(convert).toMatchObject({ input_format: from, output_format: to });
    }
  });
});
