import { db } from "@/db";
import { payments, offers, findings, properties } from "@/db/schema";
import { withAuth, isAdmin } from "@/lib/auth";
import { and, eq, desc, inArray } from "drizzle-orm";
import { awaitsPayment, offerPrepay, type OfferDecision } from "@/lib/domain/offers";
import { getPrepayThreshold } from "@/lib/settings";
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

// POST /api/payments — клиентът заявява плащане по банка за своя оферта.
// Записва се като "pending"; админът го потвърждава (/api/payments/confirm).
// Сумата идва от офертата, не от тялото на заявката.
export const POST = withAuth({ role: ["client"] }, async (request, { session }) => {
  const body = await request.json().catch(() => ({}));
  const offerId = body.offer_id;
  const method = body.method ?? body.payment_method ?? "transfer";

  if (!["transfer", "bank"].includes(method)) {
    return NextResponse.json({ error: "За плащане с карта използвайте Stripe" }, { status: 400 });
  }
  if (typeof offerId !== "string") {
    return NextResponse.json({ error: "Липсва оферта" }, { status: 400 });
  }

  const row = db
    .select({ offer: offers, owner_id: properties.owner_id })
    .from(offers)
    .innerJoin(findings, eq(offers.finding_id, findings.id))
    .innerJoin(properties, eq(findings.property_id, properties.id))
    .where(eq(offers.id, offerId))
    .get();
  if (!row || row.owner_id !== session.uid) {
    return NextResponse.json({ error: "Офертата не е намерена" }, { status: 404 });
  }

  if (!awaitsPayment(row.offer.decision as OfferDecision, offerPrepay(row.offer, getPrepayThreshold()))) {
    return NextResponse.json({ error: "Тази оферта не чака плащане" }, { status: 409 });
  }
  const duplicate = db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.offer_id, offerId), inArray(payments.status, ["pending", "paid"])))
    .get();
  if (duplicate) {
    return NextResponse.json({ error: "Вече има плащане по тази оферта — очаква потвърждение" }, { status: 409 });
  }

  const id = crypto.randomUUID();
  db.insert(payments).values({
    id,
    user_id: session.uid,
    offer_id: offerId,
    amount: row.offer.price ?? 0,
    method: "bank",
    status: "pending",
  }).run();

  const payment = db.select().from(payments).where(eq(payments.id, id)).get();
  return NextResponse.json(payment, { status: 201 });
});
