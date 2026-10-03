import { NextResponse } from "next/server";
import { db } from "@/db";
import { plans, properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/auth";
import { createSubscriptionCheckout } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

/**
 * POST /api/plans/[id]/checkout — нова Stripe връзка за абонамент, който
 * чака плащане (клиентът е затворил страницата на Stripe преди да плати).
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
  try {
    const url = await createSubscriptionCheckout(plan.id, session.uid);
    if (!url) return NextResponse.json({ error: "Плащането с карта не е настроено" }, { status: 503 });
    return NextResponse.json({ checkout_url: url });
  } catch (error) {
    console.error("[plans/checkout]", error);
    return NextResponse.json({ error: "Stripe не отговори — опитайте пак" }, { status: 502 });
  }
});
