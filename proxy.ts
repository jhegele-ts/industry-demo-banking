import { NextRequest, NextResponse } from "next/server";
import { TS_TOKEN_COOKIE } from "@/lib/thoughtspot-config";

// Next.js 16 convention: this file is proxy.ts and exports `proxy`
// (formerly middleware.ts / `middleware`).
//
// Presence-only check, deliberately. Middleware can't validate a
// ThoughtSpot token without a network call, so the real check lives in the
// page: getCurrentUser() returns null for a dead token and the page
// redirects to /login.
//
// Note what this does NOT do: redirect /login → /home when a cookie exists.
// That pairing is what creates an infinite bounce when the cookie is present
// but the token is dead — page sends you to /login, middleware sends you
// back. /login handles the signed-in case itself, using a validated lookup.
const PROTECTED = ["/home", "/analytics", "/balances"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED.some((route) => pathname.startsWith(route));
  if (!isProtected) return NextResponse.next();

  if (!request.cookies.get(TS_TOKEN_COOKIE)?.value) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/home/:path*", "/analytics/:path*", "/balances/:path*"],
};
