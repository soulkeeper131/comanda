import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureInvoice, settleOfferPayment } from "@/lib/payments";
import { settleServiceOrder } from "@/lib/service-orders";
import { settlePlanPayment } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

/**
 * POST /api/payments/confirm { paymentId } — админът потвърждава получен
 * банков превод. Същият път като Stripe: офертата става платена, фактурата
 * се прави веднъж, клиентът се уведомява.
 */
export const POST = withAuth({ role: ["admin"] }, async (request) => {
  try {
    const { paymentId } = await request.json().catch(() => ({}));
    const payment = typeof paymentId === "string" ? db.select().from(payments).where(eq(payments.id, paymentId)).get() : undefined;
    if (!payment) return NextResponse.json({ error: "Плащането не е намерено" }, { status: 404 });
    if (payment.status !== "pending") {
      return NextResponse.json({ error: "Плащането не чака потвърждение" }, { status: 400 });
    }

    if (payment.offer_id) {
      const res = await settleOfferPayment({ offerId: payment.offer_id, paymentId: payment.id, method: "bank" });
      if (!res.ok) {
        return NextResponse.json(
          { error: res.reason === "duplicate" ? "Офертата вече е платена — плащането е маркирано за възстановяване" : "Офертата не чака плащане" },
          { status: 409 },
        );
      }
      return NextResponse.json({ success: true, invoice: res.invoiceNumber });
    }

    if (payment.order_id) {
      const res = await settleServiceOrder({ orderId: payment.order_id, paymentId: payment.id, method: "bank" });
      if (!res.ok) return NextResponse.json({ error: "Заявката е оттеглена — плащането е маркирано за връщане" }, { status: 409 });
      return NextResponse.json({ success: true, invoice: res.invoiceNumber ?? null });
    }

    if (payment.plan_id) {
      const res = await settlePlanPayment(payment.id);
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: 409 });
      return NextResponse.json({ success: true, invoice: res.invoiceNumber });
    }

    db.update(payments).set({ status: "paid", paid_at: new Date().toISOString() }).where(eq(payments.id, payment.id)).run();
    const invoice = ensureInvoice(payment.id);
    return NextResponse.json({ success: true, invoice: invoice?.number ?? null });
  } catch (error) {
    console.error("[payments/confirm] Error:", error);
    return NextResponse.json({ error: "Грешка при потвърждаване на плащане" }, { status: 500 });
  }
});
