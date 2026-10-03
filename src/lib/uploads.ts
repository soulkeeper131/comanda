import path from "path";
import crypto from "crypto";
import { existsSync } from "fs";
import { mkdir, unlink, writeFile } from "fs/promises";
import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { uploads } from "@/db/schema";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** Снимки на човек за денонощие — обход е ~20, с голям запас. */
const DAILY_UPLOADS = 300;
/**
 * Качена и незакачена снимка се трие след толкова часа. С запас: офлайн
 * опашката на инспектора качва снимката и чак после я закача — ако между
 * двете падне връзката за дни, снимката трябва още да е тук.
 */
const ORPHAN_HOURS = 7 * 24;

/** "YYYY-MM-DD HH:MM:SS" (UTC) — форматът на datetime('now') в SQLite. */
const sqliteTime = (d: Date) => d.toISOString().replace("T", " ").slice(0, 19);

/** Истинският вид на снимката по първите байтове — не по името и типа от браузъра. */
export function sniffImage(buf: Buffer): ".jpg" | ".png" | ".webp" | ".gif" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return ".jpg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return ".png";
  if (buf.length >= 12 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") return ".webp";
  if (buf.length >= 6 && ["GIF87a", "GIF89a"].includes(buf.toString("latin1", 0, 6))) return ".gif";
  return null;
}

export type SavedUpload = { ok: true; filename: string } | { ok: false; error: string; status: number };

/**
 * Записва качена снимка: до 10 MB, само истински JPEG/PNG/WebP/GIF (по
 * байтовете), разширението се определя от съдържанието, с дневен лимит на
 * човек — дискът е общ с базата и пълен диск спира всичко.
 */
export async function saveImageUpload(file: File, userId: string, opts: { attached?: boolean } = {}): Promise<SavedUpload> {
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "Файлът е твърде голям (макс 10 MB)", status: 413 };
  const today = db
    .select({ n: sql<number>`count(*)` })
    .from(uploads)
    .where(and(eq(uploads.user_id, userId), gte(uploads.created_at, sqliteTime(new Date(Date.now() - 86_400_000)))))
    .get();
  if ((today?.n ?? 0) >= DAILY_UPLOADS) {
    return { ok: false, error: "Достигнат е дневният лимит за снимки — опитайте утре или пишете на екипа", status: 429 };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = sniffImage(buffer);
  if (!ext) return { ok: false, error: "Позволени са само снимки: JPEG, PNG, WebP, GIF", status: 400 };
  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${crypto.randomUUID()}${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);
  db.insert(uploads)
    .values({ filename, user_id: userId, attached_at: opts.attached ? new Date().toISOString() : null })
    .run();
  return { ok: true, filename };
}

/** Периодична задача: качени преди повече от 7 дни и незакачени никъде снимки се трият. */
export async function cleanupOrphanUploads(now = new Date()): Promise<number> {
  const stale = db
    .select({ filename: uploads.filename })
    .from(uploads)
    .where(and(isNull(uploads.attached_at), lt(uploads.created_at, sqliteTime(new Date(now.getTime() - ORPHAN_HOURS * 3600_000)))))
    .all();
  for (const row of stale) {
    const name = uploadFilename(row.filename);
    if (name && !name.startsWith(".")) await unlink(path.join(UPLOAD_DIR, name)).catch(() => {});
    db.delete(uploads).where(eq(uploads.filename, row.filename)).run();
  }
  return stale.length;
}

/** Записва кой е качил файла — нужно за claimUpload. */
export function recordUpload(filename: string, userId: string) {
  db.insert(uploads).values({ filename, user_id: userId }).onConflictDoNothing().run();
}

export const UPLOAD_DIR = path.join(process.cwd(), "data", "photos");

/** Само името на файла от storage_path ("x.jpg", "data/photos/x.jpg", "/api/photos/x.jpg"). */
export function uploadFilename(storagePath: string): string {
  return storagePath.split("/").pop() || "";
}

/**
 * Съществува ли наистина качен файл с това име. Доказателство, което сочи
 * към несъществуващ файл, не е доказателство — иначе всеки може да „качи"
 * снимка, като прати произволен низ към /api/evidence.
 */
export function uploadedFileExists(storagePath: string): boolean {
  const name = uploadFilename(storagePath);
  if (!name || name.startsWith(".") || name.includes("\\")) return false;
  return existsSync(path.join(UPLOAD_DIR, name));
}

/**
 * Приема качения файл като доказателство: само ако го е качил същият
 * потребител и още не е закачен никъде (снимка от стар обход не става
 * доказателство за нов, чужда снимка — доказателство за друг имот). Файл
 * без запис кой го е качил не се приема.
 */
export function claimUpload(storagePath: string, userId: string): boolean {
  if (!uploadedFileExists(storagePath)) return false;
  const name = uploadFilename(storagePath);
  const row = db.select().from(uploads).where(eq(uploads.filename, name)).get();
  if (!row || row.user_id !== userId || row.attached_at) return false;
  const res = db
    .update(uploads)
    .set({ attached_at: new Date().toISOString() })
    .where(and(eq(uploads.filename, name), isNull(uploads.attached_at)))
    .run();
  return res.changes === 1;
}
