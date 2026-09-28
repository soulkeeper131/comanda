import path from "path";
import { existsSync } from "fs";

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
