import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { plans, properties } from "@/db/schema";
import { withAuth } from "@/lib/auth";
import { expirePlanCheckout, requestPlanBankPayment } from "@/lib/subscriptions";
import { notifyAdmins } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/**
 * POST /api/plans/[id]/bank — клиентът, започнал с карта, избира превод.
 * Страницата в Stripe се затваря, за да не се плати два пъти.
 */
export const POST = withAuth({ role: ["client"] }, async (_request, { session, params }) => {
  const plan = db.select().from(plans).where(eq(plans.id, params.id)).get();
  const property = plan && db.select().from(properties).where(eq(properties.id, plan.property_id)).get();
  if (!plan || !property || property.owner_id !== session.uid) {
    return NextResponse.json({ error: "Абонаментът не е намерен" }, { status: 404 });
  }
  if (plan.status !== "pending_payment") {
    return NextResponse.json({ error: "Абонаментът не чака плащане" }, { status: 409 });
  }
  await expirePlanCheckout(plan.id);
  const payment = requestPlanBankPayment(plan.id);
  notifyAdmins("plan_requested", "Нов абонамент — чака превод", `${property.name} — ${plan.name}`, "/dashboard");
  return NextResponse.json({ success: true, payment_id: payment?.id });
});
