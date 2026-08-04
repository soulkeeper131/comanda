import { db } from "@/db";
import { payments } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/payments — връща плащанията на текущия user
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Не сте влезли" }, { status: 401 });
  }

  const rows = db
    .select()
    .from(payments)
    .where(eq(payments.user_id, session.uid))
    .orderBy(desc(payments.created_at))
    .all();

  return NextResponse.json(rows);
}

// POST /api/payments — създава "плащане" (бутафорно)
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Не сте влезли" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { offer_id, amount, method } = body;

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Сумата е задължителна и трябва да е положителна" }, { status: 400 });
  }

  if (method && !["card", "transfer"].includes(method)) {
    return NextResponse.json({ error: "Методът трябва да е 'card' или 'transfer'" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  db.insert(payments).values({
    id,
    user_id: session.uid,
    offer_id: offer_id || null,
    amount,
    method: method || "card",
    status: "pending",
  }).run();

  const payment = db.select().from(payments).where(eq(payments.id, id)).get();
  return NextResponse.json(payment, { status: 201 });
}
