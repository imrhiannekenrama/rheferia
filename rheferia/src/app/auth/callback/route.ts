import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * OAuth/email-confirmation callback: exchanges the auth code for a
 * session, then redirects. Degrades honestly when unconfigured.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextParam = request.nextUrl.searchParams.get("next");
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/account";

  const supabase = await getSupabaseServerClient();
  if (supabase && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("error", "confirmation");
    return NextResponse.redirect(redirectUrl);
  }

  const redirectUrl = new URL("/login", request.url);
  redirectUrl.searchParams.set("error", "unconfigured");
  return NextResponse.redirect(redirectUrl);
}
