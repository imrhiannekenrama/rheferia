import { NextRequest, NextResponse } from "next/server";
import {
  searchRequestSchema,
  toSearchRequest,
} from "@/lib/validation/search";
import { executeSearch } from "@/lib/search/execute";
import {
  checkSearchRateLimit,
  clientIpFrom,
} from "@/lib/security/rate-limit";
import { getCurrentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Public search endpoint. Guest requests are rate limited (durable when
 * configured); signed-in requests are not guest-limited. Results are
 * never cached across users.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    const limit = await checkSearchRateLimit(clientIpFrom(request.headers));
    if (!limit.allowed) {
      const message = limit.dailyLimit
        ? `You have reached the daily guest search limit (${limit.dailyLimit.limit}). Create a free account or come back tomorrow.`
        : "Too many searches right now. Please wait a moment and try again.";
      return NextResponse.json(
        {
          error: {
            code: limit.dailyLimit ? "DAILY_LIMIT" : "RATE_LIMITED",
            message,
            retryable: true,
            retryAfterSeconds: limit.retryAfterSeconds,
          },
        },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        },
      );
    }
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = searchRequestSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: parsed.error.issues[0]?.message ?? "Invalid search request",
          retryable: false,
        },
      },
      { status: 400 },
    );
  }

  const searchRequest = toSearchRequest(parsed.data);
  const response = await executeSearch(searchRequest);
  return NextResponse.json(response, {
    headers: { "Cache-Control": "no-store" },
  });
}
