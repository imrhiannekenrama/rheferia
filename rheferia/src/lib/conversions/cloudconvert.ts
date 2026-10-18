/**
 * CloudConvert client for the five cloud tools. Server-only. The job shape
 * (import/upload → convert → export/url) is pure and unit-tested; the HTTP
 * functions surface CloudConvert's real task errors instead of swallowing
 * them.
 */

import "server-only";

const API = "https://api.cloudconvert.com/v2";

export type CloudTool =
  | "pdf-to-word"
  | "word-to-pdf"
  | "compress-pdf"
  | "pdf-to-excel"
  | "excel-to-pdf"
  | "powerpoint-to-pdf";

export interface JobSpec {
  importTaskName: string;
  convertTaskName: string;
  exportTaskName: string;
  from: string;
  to: string;
  extraConvertArgs: Record<string, unknown>;
}

/** Pure: the CloudConvert task graph for each tool. */
export function jobSpecFor(tool: CloudTool, options: Record<string, string> = {}): JobSpec {
  switch (tool) {
    case "pdf-to-word":
      return {
        importTaskName: "upload-pdf",
        convertTaskName: "to-docx",
        exportTaskName: "export-result",
        from: "pdf",
        to: "docx",
        extraConvertArgs: {
          ...(options.ocr === "true" ? { ocr: true, ocr_engine: options.ocrEngine || "tesseract" } : {}),
        },
      };
    case "word-to-pdf":
      return {
        importTaskName: "upload-docx",
        convertTaskName: "to-pdf",
        exportTaskName: "export-result",
        from: "docx",
        to: "pdf",
        extraConvertArgs: {},
      };
    case "compress-pdf":
      return {
        importTaskName: "upload-pdf",
        convertTaskName: "optimize-pdf",
        exportTaskName: "export-result",
        from: "pdf",
        to: "pdf",
        extraConvertArgs: {
          engine: "qpdf",
          engine_version: "11.9.0",
          input_format: "pdf",
          ...(options.level === "strong" ? { linearize: true } : {}),
        },
      };
    case "pdf-to-excel":
      return {
        importTaskName: "upload-pdf",
        convertTaskName: "to-xlsx",
        exportTaskName: "export-result",
        from: "pdf",
        to: "xlsx",
        extraConvertArgs: {
          ...(options.ocr === "true" ? { ocr: true, ocr_engine: options.ocrEngine || "tesseract" } : {}),
        },
      };
    case "excel-to-pdf":
      return {
        importTaskName: "upload-xlsx",
        convertTaskName: "to-pdf",
        exportTaskName: "export-result",
        from: "xlsx",
        to: "pdf",
        extraConvertArgs: {},
      };
    case "powerpoint-to-pdf":
      return {
        importTaskName: "upload-pptx",
        convertTaskName: "to-pdf",
        exportTaskName: "export-result",
        from: "pptx",
        to: "pdf",
        extraConvertArgs: {},
      };
  }
}

/** Pure: the jobs POST body built from a spec. */
export function buildJobBody(spec: JobSpec): Record<string, unknown> {
  return {
    tasks: {
      [spec.importTaskName]: { operation: "import/upload" },
      [spec.convertTaskName]: {
        operation: "convert",
        input_format: spec.from,
        output_format: spec.to,
        engine: spec.extraConvertArgs.engine ?? "cloudconvert",
        ...spec.extraConvertArgs,
        input: [spec.importTaskName],
      },
      [spec.exportTaskName]: {
        operation: "export/url",
        input: [spec.convertTaskName],
        archive: false,
      },
    },
  };
}

export class CloudConvertError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "CloudConvertError";
    this.status = status;
  }
}

interface Auth { apiKey: string }

async function api<T>(auth: Auth, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${auth.apiKey}`,
      "Content-Type": "application/json",
    },
  });
  const data = (await response.json().catch(() => null)) as
    | { data?: T; message?: string; code?: number }
    | null;
  if (!response.ok) {
    throw new CloudConvertError(
      data?.message ?? `CloudConvert request failed (${response.status}).`,
      response.status,
    );
  }
  return data!.data as T;
}

export interface CreatedJob {
  id: string;
  tasks: {
    name: string;
    id: string;
    status: string;
    form?: { url: string; parameters: Record<string, string> };
  }[];
}

export async function createJob(auth: Auth, body: Record<string, unknown>): Promise<CreatedJob> {
  return api<CreatedJob>(auth, "/jobs", { method: "POST", body: JSON.stringify(body) });
}

export async function uploadFile(
  auth: Auth,
  form: { url: string; parameters: Record<string, string> },
  file: File,
): Promise<void> {
  const formData = new FormData();
  for (const [key, value] of Object.entries(form.parameters)) {
    formData.append(key, value);
  }
  formData.append("file", file);
  const response = await fetch(form.url, { method: "POST", body: formData });
  if (!response.ok) {
    throw new CloudConvertError(
      `The file upload to the converter failed (${response.status}).`,
      response.status,
    );
  }
}

interface JobStatus {
  id: string;
  status: string;
  tasks: {
    name: string;
    status: string;
    message?: string;
    code?: string;
    file?: { filename: string; size?: number };
    result?: { files?: { filename: string; url: string; size?: number }[] };
  }[];
}

export async function waitForJob(
  auth: Auth,
  jobId: string,
  onTick?: () => void,
  maxMs = 120000,
): Promise<JobStatus> {
  const started = Date.now();
  for (;;) {
    onTick?.();
    const job = await api<JobStatus>(auth, `/jobs/${jobId}`);
    if (job.status === "error") {
      const failed = job.tasks.find((task) => task.status === "error");
      throw new CloudConvertError(
        failed?.message
          ? `The converter reported: ${failed.message}`
          : "The converter failed on this file.",
        422,
      );
    }
    if (job.status === "finished") return job;
    if (Date.now() - started > maxMs) {
      throw new CloudConvertError("The conversion took too long and timed out. Try again.", 504);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

export function resultUrlOf(job: JobStatus): { filename: string; url: string } {
  const exportTask = job.tasks.find((task) => task.name.includes("export"));
  const file = exportTask?.result?.files?.[0];
  if (!file) throw new CloudConvertError("The converter did not produce a file.", 502);
  return { filename: file.filename, url: file.url };
}
