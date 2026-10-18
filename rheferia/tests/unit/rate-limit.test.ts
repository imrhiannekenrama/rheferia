import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Tests the in-memory fallback limiter (the durable Postgres path needs a
 * configured Supabase instance). Time-travel via fake timers.
 */

vi.mock("@/lib/supabase/server", () => ({
  getServiceSupabase: () => null, // force the memory fallback
}));

import { checkSearchRateLimit } from "@/lib/security/rate-limit";

describe("guest search limits (memory fallback)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows a normal sequence of searches", async () => {
    for (let i = 0; i < 5; i++) {
      await checkSearchRateLimit("ip-a"); // same ip each time
    }
    const result = await checkSearchRateLimit("ip-a");
    expect(result.allowed).toBe(true);
    expect(result.mode).toBe("memory");
  });

  it("blocks after the burst limit and reports a retry window", async () => {
    const results = [];
    for (let i = 0; i < 31; i++) {
      results.push(await checkSearchRateLimit("ip-b"));
    }
    const last = results[results.length - 1]!;
    expect(last.allowed).toBe(false);
    expect(last.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("blocks at the daily cap even after the burst window resets", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T00:00:00Z"));

    // Search up to the daily cap of 50, spread across time so no burst hits first.
    for (let i = 0; i < 50; i++) {
      vi.advanceTimersByTime(5 * 60 * 1000);
      const result = await checkSearchRateLimit("ip-c");
      expect(result.allowed).toBe(true);
    }
    // Burst window has kept resetting; the 51st search hits the daily cap.
    const blocked = await checkSearchRateLimit("ip-c");
    expect(blocked.allowed).toBe(false);
    expect(blocked.dailyLimit).toEqual({ used: 50, limit: 50 });
  });

  it("resets the daily counter at midnight UTC", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T00:00:00Z"));
    for (let i = 0; i < 50; i++) {
      vi.advanceTimersByTime(5 * 60 * 1000);
      await checkSearchRateLimit("ip-d");
    }
    expect((await checkSearchRateLimit("ip-d")).allowed).toBe(false);

    vi.setSystemTime(new Date("2026-10-18T00:00:01Z"));
    const fresh = await checkSearchRateLimit("ip-d");
    expect(fresh.allowed).toBe(true);
  });

  it("isolates different IPs", async () => {
    vi.useFakeTimers();
    for (let i = 0; i < 31; i++) {
      await checkSearchRateLimit("ip-e");
    }
    expect((await checkSearchRateLimit("ip-e")).allowed).toBe(false);
    expect((await checkSearchRateLimit("ip-f")).allowed).toBe(true);
  });
});
