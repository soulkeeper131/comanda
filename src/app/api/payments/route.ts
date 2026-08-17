import { db } from "@/db";
import { payments } from "@/db/schema";
import { withAuth, isAdmin } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/payments — връща плащанията на текущия user (админ вижда всички)
export const GET = withAuth({}, async (_request, { session }) => {
  const rows = isAdmin(session)
    ? db.select().from(payments).orderBy(desc(payments.created_at)).all()
    : db
        .select()
        .from(payments)
        .where(eq(payments.user_id, session.uid))
        .orderBy(desc(payments.created_at))
        .all();

  return NextResponse.json(rows);
});

// POST /api/payments — създава "плащане" (бутафорно)
export const POST = withAuth({}, async (request, { session }) => {
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
});
