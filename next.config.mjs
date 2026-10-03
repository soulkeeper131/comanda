const dev = process.env.NODE_ENV !== "production";

/**
 * Политика за съдържанието: скриптове, стилове, шрифтове и заявки — само от
 * нашия сайт; картите — плочките на OpenStreetMap. 'unsafe-inline' за
 * скриптовете остава, защото Next вгражда малки скриптове без nonce — но
 * външен скрипт (и eval) не може да се зареди.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
  "font-src 'self' data:",
  `connect-src 'self'${dev ? " ws:" : ""}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join("; ");

/** Заглавки за сигурност на всеки отговор. */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Камера и локация трябват на инспектора (снимки с GPS); останалото — не.
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Content-Security-Policy", value: csp },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Без сървърна обработка на снимки (/_next/image) — не я ползваме, а
  // оптимизаторът на Next е имал сериозни уязвимости.
  images: { unoptimized: true },
  // Без ignoreBuildErrors / ignoreDuringBuilds — билдът трябва да се проваля
  // при типова грешка, а не да я крие. Криеше 16, сред тях счупени PDF отчети.
  // src/instrumentation.ts (логване на неприхванати грешки) се зарежда сам от Next 15.
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
