import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = [
  "/login",
  "/api/auth",
  "/favicon.ico",
  "/_next",
  "/apple-touch-icon",
  "/manifest",
  "/icon",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files
  if (/\.(html|css|js|png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|eot|pdf|json|xml|txt|map)$/i.test(pathname)) {
    return NextResponse.next();
  }

  // Landing page is public
  if (pathname === "/") {
    return NextResponse.next();
  }

  // Check auth cookie (better-auth uses session cookie)
  const session = request.cookies.get("better-auth.session_token");
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
