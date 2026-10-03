import type { EmailAttachment } from "@/lib/email";
import { renderInvoicePdf } from "@/lib/invoice-pdf";

/** Фактурата като прикачен PDF — клиентът я получава с имейла за плащането. */
export function invoiceAttachment(invoiceId: string | null | undefined): EmailAttachment[] | undefined {
  if (!invoiceId) return undefined;
  try {
    const pdf = renderInvoicePdf(invoiceId);
    return pdf ? [{ filename: pdf.filename, content: pdf.buffer, contentType: "application/pdf" }] : undefined;
  } catch (err) {
    // Имейлът тръгва и без PDF — фактурата е и в Профил.
    console.error("[messages] invoice attachment failed:", err);
    return undefined;
  }
}
