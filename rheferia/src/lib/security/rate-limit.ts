/**
 * Guest rate limiting for public search.
 *
 * Two limits, both honest about where they run:
 *  1. Short-window burst limit (30 searches / 10 min / IP).
 *  2. Daily guest cap (default 50 searches/day / IP).
 *
 * When Supabase + a service key are configured, limits are enforced
 * durably in Postgres via the bump_rate_limit / bump_guest_usage RPCs
 * from migration 0001 (multi-instance safe, survives restarts).
 * Otherwise an in-process limiter is used and clearly reported as
 * development-only — it is NOT durable multi-instance protection.
 */

import "server-only";
import { createHash } from "node:crypto";
import { getServiceSupabase } from "@/lib/supabase/server";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  /** "durable" = Postgres-backed; "memory" = single-instance fallback. */
  mode: "durable" | "memory";
  /** Set when the daily cap was the thing that blocked. */
  dailyLimit?: { used: number; limit: number };
}

const BURST_LIMIT = 30;
const BURST_WINDOW_SECONDS = 10 * 60;
const DAILY_LIMIT = 50;

/** Hash an IP into a stable key; the raw IP is never stored. */
function keyFor(ip: string, bucket: string): string {
  const secret = process.env.RATE_LIMIT_SECRET ?? "dev-only-insecure";
  return createHash("sha256")
    .update(`${bucket}:${ip}:${secret}`)
    .digest("hex")
    .slice(0, 40);
}

/* --------------------------- in-memory fallback (dev) -------------------------- */

const windows = new Map<string, { count: number; resetAt: number }>();
const daily = new Map<string, { date: string; count: number }>();

function memoryCheck(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = windows.get(key);
  if (!entry || entry.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    if (windows.size > 5000) {
      for (const [k, v] of windows) if (v.resetAt <= now) windows.delete(k);
    }
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0, mode: "memory" };
  }
  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
      mode: "memory",
    };
  }
  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count, retryAfterSeconds: 0, mode: "memory" };
}

function memoryDailyCheck(ipHash: string): RateLimitResult {
  const today = new Date().toISOString().slice(0, 10);
  const entry = daily.get(ipHash);
  if (!entry || entry.date !== today) {
    daily.set(ipHash, { date: today, count: 1 });
    return { allowed: true, remaining: DAILY_LIMIT - 1, retryAfterSeconds: 0, mode: "memory" };
  }
  if (entry.count >= DAILY_LIMIT) {
    const tomorrow = new Date();
    tomorrow.setUTCHours(24, 0, 0, 30);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((tomorrow.getTime() - Date.now()) / 1000),
      mode: "memory",
      dailyLimit: { used: entry.count, limit: DAILY_LIMIT },
    };
  }
  entry.count += 1;
  return { allowed: true, remaining: DAILY_LIMIT - entry.count, retryAfterSeconds: 0, mode: "memory" };
}

/* --------------------------------- public API --------------------------------- */

export async function checkSearchRateLimit(ip: string): Promise<RateLimitResult> {
  const service = getServiceSupabase();
  const ipHash = keyFor(ip, "guest");
  const bucket = `guest-search:${keyFor(ip, "burst")}`;

  if (!service) {
    const burst = memoryCheck(bucket, BURST_LIMIT, BURST_WINDOW_SECONDS * 1000);
    if (!burst.allowed) return burst;
    return memoryDailyCheck(ipHash);
  }

  // Durable path: both checks in one round trip each.
  const { data: burstData, error: burstError } = await service.rpc("bump_rate_limit", {
    p_bucket: bucket,
    p_limit: BURST_LIMIT,
    p_window_seconds: BURST_WINDOW_SECONDS,
  });
  if (burstError || !burstData) {
    // Fail closed for bursts would block everyone on a DB hiccup; instead
    // fall back to memory for this request and keep the site usable.
    const fallback = memoryCheck(`fb:${bucket}`, BURST_LIMIT, BURST_WINDOW_SECONDS * 1000);
    if (!fallback.allowed) return fallback;
  } else if (burstData.allowed === false) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: burstData.retry_after_seconds ?? 60,
      mode: "durable",
    };
  }

  const { data: dailyData, error: dailyError } = await service.rpc("bump_guest_usage", {
    p_ip_hash: ipHash,
    p_field: "searches",
    p_daily_limit: DAILY_LIMIT,
  });
  if (dailyError || !dailyData) {
    return memoryDailyCheck(`fb:${ipHash}`);
  }
  if (dailyData.allowed === false) {
    const tomorrow = new Date();
    tomorrow.setUTCHours(24, 0, 0, 30);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((tomorrow.getTime() - Date.now()) / 1000),
      mode: "durable",
      dailyLimit: { used: dailyData.used, limit: dailyData.limit },
    };
  }

  return {
    allowed: true,
    remaining: Math.min(burstData?.count ? BURST_LIMIT - burstData.count : 0, dailyData.limit - dailyData.used),
    retryAfterSeconds: 0,
    mode: "durable",
  };
}

/** Extract the caller IP safely from request headers. */
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? "unknown";
}
