import { db } from "@/db";
import { invoices, settings, users } from "@/db/schema";
import { withAuth, isAdmin } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/invoices — връща фактури на текущия user (админ вижда всички)
export const GET = withAuth({}, async (_request, { session }) => {
  const rows = isAdmin(session)
    ? db.select().from(invoices).orderBy(desc(invoices.created_at)).all()
    : db
        .select()
        .from(invoices)
        .where(eq(invoices.user_id, session.uid))
        .orderBy(desc(invoices.created_at))
        .all();

  return NextResponse.json(rows);
});

// POST /api/invoices — ръчна фактура. Само админ — фактурите иначе се
// създават автоматично при потвърдено плащане. Номерът е винаги следващият
// поред (законът не допуска пропуски и повторения), не се въвежда ръчно.
export const POST = withAuth({ role: ["admin"] }, async (request, { session }) => {
  const body = await request.json().catch(() => ({}));
  const { payment_id, amount, description } = body;
  const userId = typeof body.user_id === "string" ? body.user_id : session.uid;

  if (payment_id) {
    const existing = db.select().from(invoices).where(eq(invoices.payment_id, payment_id)).get();
    if (existing) return NextResponse.json({ error: `Плащането вече има фактура ${existing.number}` }, { status: 409 });
  }
  const buyer = db.select().from(users).where(eq(users.id, userId)).get();
  const invoice = db.transaction((tx) => {
    const row = tx.select().from(settings).where(eq(settings.key, "invoice_seq")).get();
    const next = (row ? Number(row.value) : 0) + 1;
    if (row) tx.update(settings).set({ value: String(next) }).where(eq(settings.key, "invoice_seq")).run();
    else tx.insert(settings).values({ key: "invoice_seq", value: String(next) }).run();
    return tx
      .insert(invoices)
      .values({
        user_id: userId,
        payment_id: payment_id || null,
        number: String(next).padStart(10, "0"),
        amount: typeof amount === "number" ? amount : null,
        description: typeof description === "string" ? description : null,
        buyer_name: buyer?.full_name ?? null,
        buyer_email: buyer?.email ?? null,
        buyer_company: buyer?.company_name ?? null,
        buyer_eik: buyer?.eik ?? null,
        buyer_vat: buyer?.vat_number ?? null,
        buyer_address: buyer?.billing_address ?? null,
      })
      .returning()
      .get();
  });
  return NextResponse.json(invoice, { status: 201 });
});
