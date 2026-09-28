import { db } from "@/db";
import { payments } from "@/db/schema";
import { withAuth, isAdmin } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// PATCH /api/payments/[id] — сменя статус. САМО админ: иначе клиентът сам си
// маркира плащане като платено. Банковите преводи се потвърждават от админ.
export const PATCH = withAuth({ role: ["admin"] }, async (request, { session, params }) => {
  const { id } = params;
  const payment = db.select().from(payments).where(eq(payments.id, id)).get();

  if (!payment) {
    return NextResponse.json({ error: "Плащането не е намерено" }, { status: 404 });
  }

  // Само собственикът на плащането или admin може да го променя.
  // 404, не 403 — не издаваме, че плащането съществува.
  if (payment.user_id !== session.uid && !isAdmin(session)) {
    return NextResponse.json({ error: "Плащането не е намерено" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const { status } = body;

  // "Платено" минава само през /api/payments/confirm (оферта, фактура,
  // известия). Тук — отказ на чакащ превод или отбелязване, че сумата е
  // върната на клиента (след Refund в Stripe).
  const allowed: Record<string, string[]> = { cancelled: ["pending"], refunded: ["refund_needed", "paid"] };
  if (!allowed[status]?.includes(payment.status)) {
    return NextResponse.json({ error: "Тази промяна не е позволена" }, { status: 400 });
  }
  const updates: Record<string, unknown> = { status };

  db.update(payments).set(updates).where(eq(payments.id, id)).run();

  const updated = db.select().from(payments).where(eq(payments.id, id)).get();
  return NextResponse.json(updated);
});
