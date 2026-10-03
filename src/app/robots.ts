import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/mail-layout";

export const dynamic = "force-dynamic";

/**
 * Продукцията (comanda.bg) — само публичните страници в търсачките.
 * Тестовата среда (dev.comanda.bg, APP_ENV≠production) — нищо.
 */
export default function robots(): MetadataRoute.Robots {
  if ((process.env.APP_ENV || "production") !== "production") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: ["/", "/terms", "/privacy"], disallow: ["/api/", "/dashboard"] },
    host: appUrl(),
  };
}
