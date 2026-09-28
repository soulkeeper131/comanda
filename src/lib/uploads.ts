import path from "path";
import { existsSync } from "fs";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { uploads } from "@/db/schema";

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
 * доказателство за нов). Файлове отпреди таблицата uploads се приемат,
 * ако съществуват — нямат собственик, по който да се проверят.
 */
export function claimUpload(storagePath: string, userId: string): boolean {
  if (!uploadedFileExists(storagePath)) return false;
  const name = uploadFilename(storagePath);
  const row = db.select().from(uploads).where(eq(uploads.filename, name)).get();
  if (!row) return true;
  if (row.user_id !== userId || row.attached_at) return false;
  const res = db
    .update(uploads)
    .set({ attached_at: new Date().toISOString() })
    .where(and(eq(uploads.filename, name), isNull(uploads.attached_at)))
    .run();
  return res.changes === 1;
}
