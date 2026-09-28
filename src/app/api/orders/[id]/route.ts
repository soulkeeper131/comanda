import { NextResponse } from "next/server";
import { db } from "@/db";
import { serviceOrders, properties, payments } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { withAuth, isAdmin } from "@/lib/auth";
import { expireCheckoutSession } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/** DELETE /api/orders/[id] — оттегляне на неплатена заявка за услуга. */
export const DELETE = withAuth({ role: ["admin", "client"] }, async (_request, { session, params }) => {
  const order = db.select().from(serviceOrders).where(eq(serviceOrders.id, params.id)).get();
  const property = order && db.select().from(properties).where(eq(properties.id, order.property_id)).get();
  if (!order || !property || (!isAdmin(session) && property.owner_id !== session.uid)) {
    return NextResponse.json({ error: "Заявката не е намерена" }, { status: 404 });
  }
  if (order.status !== "pending_payment") {
    return NextResponse.json({ error: "Платена услуга се отказва от администратор (като обход)" }, { status: 409 });
  }
  // Отворената страница в Stripe се затваря — иначе стар таб може да бъде
  // платен след оттеглянето.
  const pending = db.select().from(payments).where(and(eq(payments.order_id, order.id), eq(payments.status, "pending"))).all();
  for (const p of pending) await expireCheckoutSession(p.stripe_session_id);
  db.transaction((tx) => {
    tx.update(serviceOrders).set({ status: "cancelled" }).where(eq(serviceOrders.id, order.id)).run();
    tx.update(payments)
      .set({ status: "cancelled" })
      .where(and(eq(payments.order_id, order.id), eq(payments.status, "pending")))
      .run();
  });
  return NextResponse.json({ success: true });
});
