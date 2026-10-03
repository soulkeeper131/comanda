import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import fs from "fs";
import path from "path";
import { backupDatabase } from "@/db";

export const dynamic = "force-dynamic";

/** Колко ръчни копия пазим — по-старите се трият, иначе дискът се пълни. */
const KEEP = 10;

/**
 * POST /api/admin/backup — копие на базата в data/backups/ (само админ).
 * POST, не GET: действие със странични ефекти не бива да тръгва от линк в
 * чужд сайт (бисквитката SameSite=Lax минава при GET от линк).
 */
export const POST = withAuth({ role: ["admin"] }, async () => {
  // Само базата — пълният архив (база + снимки) е scripts/backup-db.sh.
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
    await backupDatabase(dest);
  } catch (err) {
    console.error("[BACKUP] Copy failed:", err);
    return NextResponse.json(
      { error: "Грешка при копиране на базата" },
      { status: 500 },
    );
  }

  // Ротация на ръчните копия (тези на скрипта за бекъп са с друго име).
  const manual = fs
    .readdirSync(backupsDir)
    .filter((f) => /^sqlite-.*\.db$/.test(f))
    .sort()
    .reverse();
  for (const old of manual.slice(KEEP)) fs.rmSync(path.join(backupsDir, old), { force: true });

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
});
