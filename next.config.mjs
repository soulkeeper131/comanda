/**
 * Заглавки за сигурност на всеки отговор. CSP е само за рамкиране и base/object —
 * пълна CSP изисква nonce за inline скриптовете на Next и ще се добави отделно.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Камера и локация трябват на инспектора (снимки с GPS); останалото — не.
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Без ignoreBuildErrors / ignoreDuringBuilds — билдът трябва да се проваля
  // при типова грешка, а не да я крие. Криеше 16, сред тях счупени PDF отчети.
  experimental: {
    // src/instrumentation.ts — логване на неприхванати грешки
    instrumentationHook: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
