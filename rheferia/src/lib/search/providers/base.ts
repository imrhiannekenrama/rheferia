/**
 * Shared provider plumbing: bounded fetch with timeouts, Retry-After-aware
 * backoff, and typed capability declarations. Provider keys stay on the
 * server; none of these modules are ever imported by client components.
 */

export interface ProviderCapabilities {
  /** Full-text search over bibliographic records. */
  search: boolean;
  /** Fetch one record by native id. */
  getResource: boolean;
  /** Look up one record by DOI. */
  doiLookup: boolean;
  /** Open-access resolution from a DOI. */
  openAccessResolve: boolean;
  /** Reference graph (works this paper cites). */
  references: boolean;
}

export type FetchOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "not-configured"; message: string }
  | { ok: false; kind: "rate-limited"; message: string; retryAfterMs?: number }
  | { ok: false; kind: "timed-out"; message: string }
  | { ok: false; kind: "no-matches"; message: string }
  | { ok: false; kind: "error"; message: string; status?: number };

export class ProviderFetchError extends Error {
  constructor(
    public readonly kind:
      | "rate-limited"
      | "timed-out"
      | "no-matches"
      | "error",
    message: string,
    public readonly status?: number,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ProviderFetchError";
  }
}

const DEFAULT_TIMEOUT_MS = 9_000;
const MAX_RETRIES = 1;

/**
 * Bounded JSON fetch. Retries at most once and only when the provider says
 * to (429 with Retry-After, or a 5xx). Every response body is capped in size.
 */
export async function providerFetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init;
  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...rest,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "Rheferia/0.1 (research discovery; contact configured via env)",
          ...rest.headers,
        },
      });

      if (res.status === 404) {
        throw new ProviderFetchError("no-matches", "Record not found", 404);
      }

      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        const retryAfterMs = retryAfter
          ? Number(retryAfter) * 1000 || 60_000
          : undefined;
        throw new ProviderFetchError(
          "rate-limited",
          "Provider is rate limiting requests",
          429,
          retryAfterMs ? Math.min(retryAfterMs, 120_000) : undefined,
        );
      }

      if (res.status >= 500) {
        throw new ProviderFetchError("error", `Provider error ${res.status}`, res.status);
      }

      if (!res.ok) {
        throw new ProviderFetchError("error", `Provider responded ${res.status}`, res.status);
      }

      // Bound the response body read (16 MiB) as a decompression/size guard.
      const MAX_BYTES = 16 * 1024 * 1024;
      const buf = await readBounded(res.body, MAX_BYTES);
      return JSON.parse(new TextDecoder().decode(buf)) as T;
    } catch (err) {
      if (err instanceof ProviderFetchError) {
        const retryable =
          (err.kind === "rate-limited" || err.status === 502 || err.status === 503) &&
          attempt < MAX_RETRIES &&
          (!err.retryAfterMs || err.retryAfterMs <= 15_000);
        if (retryable) {
          attempt += 1;
          await sleep(err.retryAfterMs ?? 1_200 * attempt);
          continue;
        }
        throw err;
      }
      if (err instanceof Error && err.name === "AbortError") {
        throw new ProviderFetchError("timed-out", "Provider timed out");
      }
      throw new ProviderFetchError("error", "Provider request failed");
    } finally {
      clearTimeout(timer);
    }
  }
}

async function readBounded(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Uint8Array> {
  if (!body) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        reader.cancel().catch(() => {});
        throw new ProviderFetchError("error", "Provider response too large");
      }
      chunks.push(value);
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Map a thrown error to a user-safe provider status. */
export function errorToStatus(
  provider: string,
  err: unknown,
): {
  state: "rate-limited" | "timed-out" | "error" | "no-matches";
  message: string;
} {
  if (err instanceof ProviderFetchError) {
    if (err.kind === "no-matches")
      return { state: "no-matches", message: "No matching records" };
    if (err.kind === "rate-limited")
      return { state: "rate-limited", message: "Provider rate limit reached; some sources may be missing" };
    if (err.kind === "timed-out")
      return { state: "timed-out", message: "Provider took too long to respond" };
  }
  return { state: "error", message: "Provider temporarily unavailable" };
}
