import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { withAuth } from "@/lib/auth";
import { runPeriodic } from "@/lib/periodic";

export const dynamic = "force-dynamic";

function secretMatches(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16 || !header?.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const asAdmin = withAuth({ role: ["admin"] }, async () => NextResponse.json(await runPeriodic()));

/**
 * POST /api/cron — периодичните задачи (scripts/cron.mjs от Coolify).
 * Пуска се със `Authorization: Bearer $CRON_SECRET`, или от админ с бутона
 * „Пусни сега" (тогава минава през withAuth).
 */
// @public Защитен с CRON_SECRET в хедъра; без него пада към админска сесия (withAuth).
export async function POST(request: Request) {
  if (secretMatches(request.headers.get("authorization"))) {
    try {
      return NextResponse.json(await runPeriodic());
    } catch (error) {
      console.error("[cron] error:", error);
      return NextResponse.json({ error: "cron failed" }, { status: 500 });
    }
  }
  return asAdmin(request, { params: Promise.resolve({}) });
}
