import type { NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

// Session refresh runs on the landing page, the app, auth, and the public pages a signed-in
// user still visits (pricing, terms, privacy, email verification, password update).
// Assets and the manifest stay outside the matcher. Route guards live in updateSession.
export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/ledger/:path*",
    "/chat/:path*",
    "/teams/:path*",
    "/login",
    "/register",
    "/recovery",
    "/verify",
    "/update-password",
    "/pricing",
    "/terms",
    "/privacy",
    "/onboarding",
    "/auth/:path*",
    "/en",
    "/es",
    "/pt",
    "/fr",
    "/de",
    "/it",
    "/ru",
    "/zh",
    "/ja",
    "/ko",
    "/hi",
    "/ar",
  ],
};
