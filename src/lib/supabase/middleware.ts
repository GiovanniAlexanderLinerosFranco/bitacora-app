import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { localeFromPathname } from "../public-locale";
import { publicEnv } from "../env";
import { LOCALE_COOKIE, LOCALES } from "../../types";

export const PROTECTED_PREFIXES = ["/dashboard", "/ledger", "/chat", "/teams", "/onboarding"];
export const AUTH_ROUTES = ["/", "/login", "/register", "/recovery", ...LOCALES.map((locale) => `/${locale}`)];

const matches = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/** Forwards the public locale and the refreshed cookies. `cookies()` does not see a cookie written only on the response. */
function nextWithLocale(request: NextRequest, pathLocale: string | null) {
  const headers = new Headers(request.headers);
  if (pathLocale) headers.set("x-bitacora-locale", pathLocale);
  const cookie = request.cookies
    .getAll()
    .map((item) => `${item.name}=${item.value}`)
    .join("; ");
  if (cookie) headers.set("cookie", cookie);
  return NextResponse.next({ request: { headers } });
}

/** Refreshes the Supabase session cookies and applies route guards. */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const pathLocale = localeFromPathname(request.nextUrl.pathname);
  if (pathLocale) request.cookies.set(LOCALE_COOKIE, pathLocale);

  let response = nextWithLocale(request, pathLocale);

  const supabase = createServerClient(publicEnv.supabaseUrl(), publicEnv.supabaseAnonKey(), {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = nextWithLocale(request, pathLocale);
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() revalidates the token with Supabase; never trust getSession() here.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  if (pathLocale) {
    response.cookies.set(LOCALE_COOKIE, pathLocale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }

  const redirectTo = (pathname: string, params?: Record<string, string>) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    Object.entries(params ?? {}).forEach(([k, v]) => url.searchParams.set(k, v));
    const redirect = NextResponse.redirect(url);
    // Preserve refreshed auth cookies on the redirect response.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!user && PROTECTED_PREFIXES.some((p) => matches(path, p))) {
    return redirectTo("/login", { next: path + request.nextUrl.search });
  }
  if (user && AUTH_ROUTES.some((p) => matches(path, p))) {
    return redirectTo("/dashboard");
  }
  return response;
}
