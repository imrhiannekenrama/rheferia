import { NextRequest, NextResponse } from "next/server";
import { appEnvConfig } from "@/lib/config/env";
import {
  CloudConvertError,
  buildJobBody,
  createJob,
  jobSpecFor,
  resultUrlOf,
  uploadFile,
  waitForJob,
  type CloudTool,
} from "@/lib/conversions/cloudconvert";

export const dynamic = "force-dynamic";
export const maxDuration = 150;

const SLUG_TO_TOOL: Record<string, CloudTool> = {
  "pdf-to-word": "pdf-to-word",
  "word-to-pdf": "word-to-pdf",
  "compress-pdf": "compress-pdf",
  "pdf-to-excel": "pdf-to-excel",
  "excel-to-pdf": "excel-to-pdf",
  "powerpoint-to-pdf": "powerpoint-to-pdf",
};

const INPUT_MIME: Record<CloudTool, string[]> = {
  "pdf-to-word": ["application/pdf"],
  "word-to-pdf": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  "compress-pdf": ["application/pdf"],
  "pdf-to-excel": ["application/pdf"],
  "excel-to-pdf": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  "powerpoint-to-pdf": ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
};

const OUTPUT_NAME: Record<CloudTool, string> = {
  "pdf-to-word": "converted.docx",
  "word-to-pdf": "converted.pdf",
  "compress-pdf": "compressed.pdf",
  "pdf-to-excel": "converted.xlsx",
  "excel-to-pdf": "converted.pdf",
  "powerpoint-to-pdf": "converted.pdf",
};

/** Simple per-instance limiter; honest about its scope in responses. */
const hits = new Map<string, { count: number; day: string }>();

function dailyHits(ip: string): number {
  const day = new Date().toISOString().slice(0, 10);
  const entry = hits.get(ip);
  if (!entry || entry.day !== day) {
    hits.set(ip, { count: 0, day });
    return 0;
  }
  return entry.count;
}

function recordHit(ip: string): void {
  const day = new Date().toISOString().slice(0, 10);
  const entry = hits.get(ip);
  hits.set(ip, { count: (entry && entry.day === day ? entry.count : 0) + 1, day });
}

function errorResponse(status: number, code: string, message: string, retryable: boolean) {
  return NextResponse.json({ error: { code, message, retryable } }, { status });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const tool = SLUG_TO_TOOL[slug];
  if (!tool) {
    return errorResponse(404, "UNKNOWN_TOOL", "This conversion tool does not exist.", false);
  }

  const apiKey = process.env.CLOUDCONVERT_API_KEY?.trim();
  if (!apiKey) {
    return errorResponse(
      503,
      "PROVIDER_NOT_CONFIGURED",
      "The cloud converter is not configured on this deployment. Set CLOUDCONVERT_API_KEY to enable it — the tools page shows the current setup state.",
      false,
    );
  }

  const env = appEnvConfig();

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  if (dailyHits(ip) >= env.maxDailyCloudConversions) {
    return errorResponse(
      429,
      "RATE_LIMIT",
      `You have reached the daily limit of ${env.maxDailyCloudConversions} cloud conversions. Browser tools (merge, split, rotate, and friends) are unlimited.`,
      false,
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse(400, "INVALID_FORM", "Send the file as multipart form data.", false);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return errorResponse(400, "NO_FILE", "Attach the file you want to convert.", false);
  }

  const maxBytes = env.maxCloudUploadMiB * 1024 * 1024;
  if (file.size > maxBytes) {
    return errorResponse(
      413,
      "FILE_TOO_LARGE",
      `This file is ${(file.size / 1024 / 1024).toFixed(1)} MiB; the cloud limit is ${env.maxCloudUploadMiB} MiB.`,
      false,
    );
  }

  const accepts = INPUT_MIME[tool];
  const declaredType = file.type || "application/octet-stream";
  const extensionOk = (() => {
    const name = file.name.toLowerCase();
    if (tool === "pdf-to-word" || tool === "compress-pdf" || tool === "pdf-to-excel") return name.endsWith(".pdf");
    if (tool === "word-to-pdf") return name.endsWith(".docx");
    if (tool === "excel-to-pdf") return name.endsWith(".xlsx");
    if (tool === "powerpoint-to-pdf") return name.endsWith(".pptx");
    return true;
  })();
  if (!accepts.includes(declaredType) && !extensionOk) {
    return errorResponse(
      415,
      "WRONG_TYPE",
      `This tool expects ${accepts.join(", ")}. The file looks like ${declaredType}.`,
      false,
    );
  }

  const options: Record<string, string> = {};
  for (const key of ["ocr", "ocrEngine", "level"]) {
    const value = form.get(key);
    if (typeof value === "string") options[key] = value;
  }

  recordHit(ip);

  try {
    const spec = jobSpecFor(tool, options);
    const job = await createJob({ apiKey }, buildJobBody(spec));
    const uploadTask = job.tasks.find((task) => task.name === spec.importTaskName);
    if (!uploadTask?.form) {
      throw new CloudConvertError("The converter did not provide an upload target.", 502);
    }
    await uploadFile({ apiKey }, uploadTask.form, file);
    const finished = await waitForJob({ apiKey }, job.id);
    const { filename, url } = resultUrlOf(finished);

    const converted = await fetch(url);
    if (!converted.ok) {
      throw new CloudConvertError("Downloading the converted file failed. Try again.", 502);
    }
    const bytes = new Uint8Array(await converted.arrayBuffer());

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type":
          tool === "pdf-to-word"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : tool === "pdf-to-excel"
              ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              : "application/pdf",
        "Content-Disposition": `attachment; filename="${filename || OUTPUT_NAME[tool]}"`,
        "Cache-Control": "no-store",
        "X-Conversion-Input-Size": String(file.size),
        "X-Conversion-Output-Size": String(bytes.byteLength),
      },
    });
  } catch (error) {
    if (error instanceof CloudConvertError) {
      return errorResponse(error.status >= 400 ? error.status : 502, "CONVERSION_FAILED", error.message, true);
    }
    return errorResponse(
      502,
      "CONVERSION_FAILED",
      "The conversion could not be completed. Try again in a moment.",
      true,
    );
  }
}
