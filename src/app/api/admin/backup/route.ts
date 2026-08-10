import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/backup
 *
 * Creates a timestamped copy of data/sqlite.db into data/backups/.
 * Only admin users can call this endpoint.
 * Returns { success, path, filename } with the backup file info.
 */
export async function GET() {
  // ── Auth: admin only ────────────────────────────────────────────────
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json(
      { error: "Нямате права за тази операция" },
      { status: 403 },
    );
  }

  const dbDir = path.join(process.cwd(), "data");
  const src = path.join(dbDir, "sqlite.db");

  if (!fs.existsSync(src)) {
    return NextResponse.json(
      { error: "Базата данни не е намерена" },
      { status: 404 },
    );
  }

  // ── Create backup ───────────────────────────────────────────────────
  const backupsDir = path.join(dbDir, "backups");
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `sqlite-${ts}.db`;
  const dest = path.join(backupsDir, filename);

  try {
    fs.copyFileSync(src, dest);
  } catch (err) {
    console.error("[BACKUP] Copy failed:", err);
    return NextResponse.json(
      { error: "Грешка при копиране на базата" },
      { status: 500 },
    );
  }

  // ── Stats ───────────────────────────────────────────────────────────
  const srcStat = fs.statSync(src);
  const destStat = fs.statSync(dest);

  console.log(`[BACKUP] Created ${filename} (${(destStat.size / 1024).toFixed(1)} KB)`);

  return NextResponse.json({
    success: true,
    filename,
    path: `/data/backups/${filename}`,
    sizeBytes: destStat.size,
    originalSizeBytes: srcStat.size,
    createdAt: new Date().toISOString(),
  });
}
