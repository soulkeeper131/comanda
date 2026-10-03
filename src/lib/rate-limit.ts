/**
 * In-memory rate limiter for Next.js middleware (Edge-compatible).
 *
 * Configuration:
 *   - API routes: 60 requests per minute
 *   - Login:       5 requests per minute
 *
 * Uses IP + endpoint as key. Cleanup runs on every request (O(n) sweep of expired entries).
 */

type WindowEntry = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 60_000; // 1 minute sliding window

const windows = new Map<string, WindowEntry>();

/** Max requests per minute per endpoint type */
function getLimit(pathname: string): number {
  // Само опитите за вход — зареждането на страницата /login не е опит.
  if (
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/register" ||
    pathname === "/api/auth/forgot" ||
    pathname === "/api/auth/resend-verification" ||
    pathname === "/api/auth/reset" ||
    pathname === "/api/auth/verify" ||
    // Публичната форма праща имейли до въведения адрес и до целия екип.
    pathname === "/api/inquiries"
  ) {
    return 5;
  }
  return 60;
}

/**
 * Ключът за лимита: IPv4 адресът, а при IPv6 — мрежата /64. Един абонат
 * получава цяла /64 и иначе сменя адреса си при всеки опит.
 */
export function ipKey(ip: string): string {
  const v = ip.trim().toLowerCase();
  if (!v.includes(":")) return v;
  if (v.startsWith("::ffff:") && v.includes(".")) return v.slice(7); // IPv4 през IPv6
  const [head, tail] = v.split("::");
  const h = head ? head.split(":") : [];
  const t = tail !== undefined && tail ? tail.split(":") : [];
  const groups = tail !== undefined ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t] : h;
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "") || "0").join(":")}::/64`;
}

/**
 * IP на клиента. Първата стойност в X-Forwarded-For се задава от клиента и
 * е подправима — с въртене на хедъра лимитът за вход се заобикаля. Traefik
 * (Coolify) слага реалния адрес в X-Real-Ip и го добавя НАКРАЯ на XFF.
 */
function getIP(request: Request): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((h) => h.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  // In Edge/Node, fallback to connection info if available
  const req = request as Request & { ip?: string };
  return req.ip ?? "127.0.0.1";
}

/**
 * Check rate limit. Returns { allowed, remaining, reset }.
 * If allowed=false, caller should return 429.
 */
export function checkRateLimit(request: Request, pathname: string): {
  allowed: boolean;
  remaining: number;
  reset: number; // ms until reset
} {
  const ip = ipKey(getIP(request));
  const key = `${ip}:${pathname}`;
  const now = Date.now();
  const limit = getLimit(pathname);

  const existing = windows.get(key);

  // Expired window → reset
  if (!existing || now > existing.resetAt) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: limit - 1, reset: WINDOW_MS };
  }

  existing.count++;

  // Periodic cleanup: sweep entries expired for > 2x window
  if (Math.random() < 0.01) {
    const cutoff = now - WINDOW_MS * 2;
    windows.forEach((v, k) => {
      if (v.resetAt < cutoff) windows.delete(k);
    });
  }

  const remaining = Math.max(0, limit - existing.count);
  const reset = existing.resetAt - now;

  if (existing.count > limit) {
    return { allowed: false, remaining: 0, reset };
  }

  return { allowed: true, remaining, reset };
}

/**
 * Convenience: returns a 429 JSON Response with rate-limit headers.
 */
export function rateLimitedResponse(resetMs: number): Response {
  return new Response(
    JSON.stringify({
      error: "Твърде много заявки. Опитайте отново след минута.",
      retryAfter: Math.ceil(resetMs / 1000),
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(resetMs / 1000)),
        "X-RateLimit-Remaining": "0",
      },
    },
  );
}

/** Само за тестове — изчиства броячите между случаите. */
export function __resetForTests(): void {
  windows.clear();
}
