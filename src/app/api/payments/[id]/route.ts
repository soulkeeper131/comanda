import { db } from "@/db";
import { payments } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// PATCH /api/payments/[id] — сменя статус ("paid") — БУТАФОРНО
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Не сте влезли" }, { status: 401 });
  }

  const { id } = params;
  const payment = db.select().from(payments).where(eq(payments.id, id)).get();

  if (!payment) {
    return NextResponse.json({ error: "Плащането не е намерено" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const { status } = body;

  if (!status || !["pending", "paid", "cancelled"].includes(status)) {
    return NextResponse.json({ error: "Статусът трябва да е 'pending', 'paid' или 'cancelled'" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { status };
  if (status === "paid") {
    updates.paid_at = new Date().toISOString();
  }

  db.update(payments).set(updates).where(eq(payments.id, id)).run();

  const updated = db.select().from(payments).where(eq(payments.id, id)).get();
  return NextResponse.json(updated);
}
