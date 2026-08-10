/**
 * In-memory rate limiter for Next.js middleware (Edge-compatible).
 *
 * Configuration:
 *   - API routes: 60 requests per minute
 *   - Login:      10 requests per minute
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
  if (pathname === "/api/auth/login" || pathname.startsWith("/login")) {
    return 10;
  }
  return 60;
}

/** Extract client IP, respecting x-forwarded-for */
function getIP(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    return xff.split(",")[0].trim();
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
  const ip = getIP(request);
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
