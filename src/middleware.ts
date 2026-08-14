import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";

/** Пътища, достъпни без сесия. */
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/inquiries",
  "/api/stripe/webhook",
  "/api/push/vapid-public-key",
];

const STATIC_PATTERN =
  /\.(html|css|js|png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|eot|pdf|json|xml|txt|map)$/i;

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/register/")) return true;
  if (pathname === "/manifest.json" || pathname === "/sw.js") return true;
  return STATIC_PATTERN.test(pathname);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Rate limiting — независимо от auth, не прекъсва потока
  let rateLimitRemaining: number | null = null;
  if (pathname.startsWith("/api/") || pathname === "/login") {
    const rl = checkRateLimit(request, pathname);
    if (!rl.allowed) return rateLimitedResponse(rl.reset);
    rateLimitRemaining = rl.remaining;
  }

  // 2. Публичните пътища минават нататък
  if (isPublic(pathname)) {
    const response = NextResponse.next();
    if (rateLimitRemaining !== null) {
      response.headers.set("X-RateLimit-Remaining", String(rateLimitRemaining));
    }
    return response;
  }

  // 3. Страници без сесия → към login.
  //    API routes се пазят от withAuth, не тук — middleware не може да
  //    провери HMAC подписа (Edge runtime няма node:crypto).
  if (!pathname.startsWith("/api/")) {
    const session = request.cookies.get("komanda_session");
    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  const response = NextResponse.next();
  if (rateLimitRemaining !== null) {
    response.headers.set("X-RateLimit-Remaining", String(rateLimitRemaining));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
