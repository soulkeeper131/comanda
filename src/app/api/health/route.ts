import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

const startedAt = Date.now();

// @public Проверка за Coolify/Docker healthcheck и външен монитор — без данни за потребители.
export async function GET() {
  try {
    db.get(sql`select 1`);
    return NextResponse.json(
      {
        ok: true,
        env: process.env.APP_ENV || "production",
        // Coolify подава SOURCE_COMMIT при билд — кой код реално върви.
        commit: (process.env.SOURCE_COMMIT || "").slice(0, 7) || undefined,
        uptime_s: Math.round((Date.now() - startedAt) / 1000),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[health] DB check failed:", err);
    return NextResponse.json({ ok: false, error: "database" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
