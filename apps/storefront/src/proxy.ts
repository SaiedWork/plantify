import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Optimistic gate only: it checks that a session cookie exists. The API re-validates
// the session on every real request, so a forged cookie gets no data.
const SESSION_COOKIES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

export function proxy(request: NextRequest) {
  if (SESSION_COOKIES.some((name) => request.cookies.has(name))) return NextResponse.next();
  const url = new URL("/sign-in", request.url);
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/account/:path*", "/checkout/:path*"],
};
