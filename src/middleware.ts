import type { NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

// Matches the landing page, the app routes and the auth routes; everything else (assets, manifest) is untouched.
export const config = {
  matcher: ["/", "/dashboard/:path*", "/ledger/:path*", "/chat/:path*", "/login", "/auth/:path*"],
};
