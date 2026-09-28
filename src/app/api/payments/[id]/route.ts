import { db } from "@/db";
import { payments, serviceOrders } from "@/db/schema";
import { withAuth, isAdmin } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { refundPayment } from "@/lib/refunds";
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
  // върната на клиента.
  const allowed: Record<string, string[]> = { cancelled: ["pending"], refunded: ["refund_needed", "paid"] };
  if (!allowed[status]?.includes(payment.status)) {
    return NextResponse.json({ error: "Тази промяна не е позволена" }, { status: 400 });
  }

  if (status === "refunded") {
    // Карта → истинско връщане през Stripe + кредитно известие; банка →
    // админът е превел сам, тук само се отбелязва (и кредитно известие).
    const res = await refundPayment(id);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 502 });
  } else {
    db.update(payments).set({ status }).where(eq(payments.id, id)).run();
    if (payment.order_id) {
      // Отказан превод за услуга — и заявката спира да чака.
      db.update(serviceOrders).set({ status: "cancelled" }).where(and(eq(serviceOrders.id, payment.order_id), eq(serviceOrders.status, "pending_payment"))).run();
    }
  }

  const updated = db.select().from(payments).where(eq(payments.id, id)).get();
  return NextResponse.json(updated);
});
