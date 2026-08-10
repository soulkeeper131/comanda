import { db } from "@/db";
import { invoices } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/invoices — връща фактури на текущия user
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Не сте влезли" }, { status: 401 });
  }

  const rows = db
    .select()
    .from(invoices)
    .where(eq(invoices.user_id, session.uid))
    .orderBy(desc(invoices.created_at))
    .all();

  return NextResponse.json(rows);
}

// POST /api/invoices — генерира "фактура" (просто запис с номер)
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Не сте влезли" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { payment_id, number, amount, description } = body;

  if (!number) {
    return NextResponse.json({ error: "Номер на фактура е задължителен" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  db.insert(invoices).values({
    id,
    user_id: session.uid,
    payment_id: payment_id || null,
    number,
    amount: amount ?? null,
    description: description ?? null,
  }).run();

  const invoice = db.select().from(invoices).where(eq(invoices.id, id)).get();
  return NextResponse.json(invoice, { status: 201 });
}
