import type jsPDF from "jspdf";
import { readFileSync } from "fs";
import path from "path";

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
let cache: { regular: string; bold: string } | null = null;

function load() {
  if (!cache) {
    cache = {
      regular: readFileSync(path.join(FONT_DIR, "DejaVuSans.ttf")).toString("base64"),
      bold: readFileSync(path.join(FONT_DIR, "DejaVuSans-Bold.ttf")).toString("base64"),
    };
  }
  return cache;
}

export const PDF_FONT = "DejaVu";

/**
 * Шрифт с кирилица за jsPDF. Вграденият Helvetica няма кирилица и
 * българският текст излизаше като безсмислени знаци.
 */
export function applyCyrillicFont(doc: jsPDF): void {
  const f = load();
  doc.addFileToVFS("DejaVuSans.ttf", f.regular);
  doc.addFont("DejaVuSans.ttf", PDF_FONT, "normal");
  doc.addFileToVFS("DejaVuSans-Bold.ttf", f.bold);
  doc.addFont("DejaVuSans-Bold.ttf", PDF_FONT, "bold");
  doc.setFont(PDF_FONT, "normal");
}
