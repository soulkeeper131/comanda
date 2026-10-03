import { db } from "@/db";
import { invoices } from "@/db/schema";
import { withAuth, isAdmin } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { renderInvoicePdf } from "@/lib/invoice-pdf";

export const dynamic = "force-dynamic";

// GET /api/invoices/[id]/pdf — фактурата (или кредитното известие) като PDF
export const GET = withAuth({}, async (_request, { session, params }) => {
  const invoice = db.select({ id: invoices.id, user_id: invoices.user_id }).from(invoices).where(eq(invoices.id, params.id)).get();
  // Само собственикът на фактурата или admin. 404, не 403 — не издаваме, че съществува.
  if (!invoice || (invoice.user_id !== session.uid && !isAdmin(session))) {
    return NextResponse.json({ error: "Фактурата не е намерена" }, { status: 404 });
  }
  const pdf = renderInvoicePdf(invoice.id);
  if (!pdf) return NextResponse.json({ error: "Фактурата не е намерена" }, { status: 404 });
  // Uint8Array, не суров Buffer — консистентно с останалите PDF/файлови routes.
  return new NextResponse(new Uint8Array(pdf.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdf.filename}"`,
      "Content-Length": pdf.buffer.length.toString(),
    },
  });
});
