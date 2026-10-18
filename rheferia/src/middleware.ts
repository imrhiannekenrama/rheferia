import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Session refresh middleware. Keeps auth cookies fresh across RSC
 * navigation and protects /account, /projects, and /account routes.
 * When Supabase is unconfigured, protected routes redirect to /login
 * (which explains the setup state honestly) and everything else passes.
 */

const PROTECTED = ["/account", "/projects"];

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  let response = NextResponse.next({ request });

  if (url && anonKey) {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const path = request.nextUrl.pathname;
    if (user && (path === "/login" || path === "/signup")) {
      return NextResponse.redirect(new URL("/account", request.url));
    }
    if (!user && PROTECTED.some((p) => path.startsWith(p))) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/login";
      redirect.searchParams.set("next", path);
      return NextResponse.redirect(redirect);
    }
    return response;
  }

  // Unconfigured: protect nothing that needs data, but keep flow honest.
  const path = request.nextUrl.pathname;
  if (PROTECTED.some((p) => path.startsWith(p))) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    return NextResponse.redirect(redirect);
  }
  return response;
}

export const config = {
  matcher: [
    "/account/:path*",
    "/projects/:path*",
    "/login",
    "/signup",
  ],
};
