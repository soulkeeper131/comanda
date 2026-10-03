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
  "/api/auth/verify",
  "/api/auth/resend-verification",
  "/api/auth/forgot",
  "/api/auth/reset",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/terms",
  "/privacy",
  "/api/inquiries",
  "/api/stripe/webhook",
  "/api/push/vapid-public-key",
  "/api/cron",
  "/api/health",
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

/** Най-голямото тяло, което приемаме — снимките до 10 MB, всичко друго е малко. */
function maxBodyBytes(pathname: string): number {
  if (pathname === "/api/upload" || pathname === "/api/finding-photos") return 11 * 1024 * 1024;
  if (pathname === "/api/stripe/webhook") return 1024 * 1024;
  return 256 * 1024;
}

/** Викат се от сървъри (Stripe, cron с ключ), не от браузър — без проверка на Origin. */
const MACHINE_PATHS = ["/api/stripe/webhook", "/api/cron"];

/**
 * Заявка с Origin от друг сайт не се приема (CSRF — напр. скрита форма,
 * която вписва жертвата в профила на нападателя). Без Origin — заявката не е
 * от съвременен браузър; там пази бисквитката SameSite=Lax.
 */
function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  const allowed = new Set<string>([request.nextUrl.host]);
  for (const h of [request.headers.get("host"), request.headers.get("x-forwarded-host")]) if (h) allowed.add(h);
  try {
    if (process.env.APP_URL) allowed.add(new URL(process.env.APP_URL).host);
  } catch {
    /* невалиден APP_URL — само хостът на заявката */
  }
  return allowed.has(host);
}

function reject(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Rate limiting — независимо от auth, не прекъсва потока
  let rateLimitRemaining: number | null = null;
  if (pathname.startsWith("/api/")) {
    const rl = checkRateLimit(request, pathname);
    if (!rl.allowed) return rateLimitedResponse(rl.reset);
    rateLimitRemaining = rl.remaining;

    // 1б. Тяло на заявката: с обявена дължина и в лимита — иначе няколко
    // огромни заявки изяждат паметта; и само от нашия сайт.
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const length = request.headers.get("content-length");
      if (length === null && request.headers.get("transfer-encoding")) {
        return reject(411, "Заявката трябва да има дължина");
      }
      if (length !== null && !(Number(length) <= maxBodyBytes(pathname))) {
        return reject(413, "Заявката е твърде голяма");
      }
      if (!MACHINE_PATHS.includes(pathname) && !sameOrigin(request)) {
        return reject(403, "Заявката не е от сайта на Ко Манда");
      }
    }
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
