import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Optimistic gate only: checks that a session cookie exists. Real authorization is the API's job
// (every endpoint checks session + role), so a forged cookie yields no data.
const SESSION_COOKIES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

export function proxy(request: NextRequest) {
  if (SESSION_COOKIES.some((name) => request.cookies.has(name))) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Everything except the login page, API proxy and Next internals/static files.
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico).*)"],
};
