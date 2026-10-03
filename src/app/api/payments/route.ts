import { db } from "@/db";
import { payments, offers, findings, properties, users, invoices, serviceOrders, serviceTemplates, plans } from "@/db/schema";
import { expireCheckoutSession } from "@/lib/stripe";
import { bankReference, formatMoney, paymentReference } from "@/lib/format";
import { bankRows, notify } from "@/lib/messages";
import { withAuth, isAdmin } from "@/lib/auth";
import { and, eq, desc, inArray } from "drizzle-orm";
import { awaitsPayment, offerPrepay, type OfferDecision } from "@/lib/domain/offers";
import { getPrepayThreshold } from "@/lib/settings";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/payments — плащанията на клиента; админът вижда всички, с
// клиента, за какво е плащането и номера на фактурата.
export const GET = withAuth({}, async (_request, { session }) => {
  const rows = db
    .select({
      payment: payments,
      user_name: users.full_name,
      user_email: users.email,
      finding_title: findings.title,
      order_service: serviceTemplates.name,
      plan_name: plans.name,
      invoice_id: invoices.id,
      invoice_number: invoices.number,
      invoice_description: invoices.description,
    })
    .from(payments)
    .leftJoin(users, eq(payments.user_id, users.id))
    .leftJoin(offers, eq(payments.offer_id, offers.id))
    .leftJoin(findings, eq(offers.finding_id, findings.id))
    .leftJoin(invoices, eq(invoices.payment_id, payments.id))
    .leftJoin(serviceOrders, eq(payments.order_id, serviceOrders.id))
    .leftJoin(serviceTemplates, eq(serviceOrders.template_id, serviceTemplates.id))
    .leftJoin(plans, eq(payments.plan_id, plans.id))
    .where(isAdmin(session) ? undefined : eq(payments.user_id, session.uid))
    .orderBy(desc(payments.created_at))
    .limit(500)
    .all();

  return NextResponse.json(
    rows.map((r) => ({
      ...r.payment,
      user_name: isAdmin(session) ? r.user_name : undefined,
      user_email: isAdmin(session) ? r.user_email : undefined,
      description:
        r.invoice_description ??
        (r.finding_title ? `Ремонт: ${r.finding_title}` : r.order_service ? `Услуга: ${r.order_service}` : r.plan_name ? `Абонамент: ${r.plan_name}` : "Абонамент"),
      invoice_id: r.invoice_id,
      invoice_number: r.invoice_number,
      // Основанието, с което клиентът превежда — по него админът намира превода.
      reference: paymentReference(r.payment),
    })),
  );
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
    .select({ offer: offers, owner_id: properties.owner_id, finding_title: findings.title })
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
  const live = db
    .select()
    .from(payments)
    .where(and(eq(payments.offer_id, offerId), inArray(payments.status, ["pending", "paid"])))
    .all();
  // Изоставено плащане с карта не пречи да се избере превод — страницата му
  // в Stripe се затваря, за да не се плати два пъти.
  for (const p of live.filter((x) => x.method === "card" && x.status === "pending")) {
    await expireCheckoutSession(p.stripe_session_id);
    db.update(payments).set({ status: "cancelled" }).where(eq(payments.id, p.id)).run();
  }
  const duplicate = live.find((x) => x.method !== "card" || x.status === "paid");
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
  // Данните за превод и по имейл — клиентът не бива да ги търси в приложението;
  // екипът знае, че трябва да очаква превод.
  const client = db.select({ name: users.full_name, email: users.email }).from(users).where(eq(users.id, session.uid)).get();
  const what = row.finding_title ?? "ремонт";
  await notify("bank_transfer_details", {
    to: session.uid,
    vars: { amount: formatMoney(row.offer.price), what },
    rows: bankRows(bankReference("offer", offerId), row.offer.price),
  });
  await notify("bank_transfer_team", {
    to: "admins",
    vars: { client: client?.name ?? client?.email ?? "", what, amount: formatMoney(row.offer.price) },
  });
  return NextResponse.json(payment, { status: 201 });
});
