import { NextResponse, type NextRequest } from "next/server";

/**
 * A cheap first gate only. It checks that a session cookie exists so we can
 * bounce anonymous visitors without a database round trip at the edge; the real
 * role check happens in requireStaff/assertStaff on every admin page and action.
 */
const SESSION_COOKIE_CANDIDATES = [
  "rivana.session_token",
  "__Secure-rivana.session_token",
];

function hasSessionCookie(request: NextRequest) {
  return SESSION_COOKIE_CANDIDATES.some((name) => request.cookies.has(name));
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isAdminArea =
    pathname.startsWith("/admin") && pathname !== "/admin/login";
  const isAccountArea = pathname.startsWith("/account");

  if (!isAdminArea && !isAccountArea) return NextResponse.next();
  if (hasSessionCookie(request)) return NextResponse.next();

  const loginPath = isAdminArea ? "/admin/login" : "/login";
  const url = request.nextUrl.clone();
  url.pathname = loginPath;
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};
