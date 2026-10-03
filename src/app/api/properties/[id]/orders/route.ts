import { NextResponse } from "next/server";
import { db } from "@/db";
import { properties, serviceOrders, serviceTemplates, payments } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { withAuth, canViewProperty } from "@/lib/auth";
import { getStripeOrNull, eurToCents, validateStripeAmount } from "@/lib/stripe";
import { ensureStripeCustomer } from "@/lib/subscriptions";
import { settleServiceOrder } from "@/lib/service-orders";
import { appUrl } from "@/lib/mail-layout";
import { todaySofia } from "@/lib/jobs-generator";
import { addDays } from "@/lib/domain/schedule";
import { bankRows, notify } from "@/lib/messages";
import { bankReference, formatDateOnly, formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

/** GET — допълнителните услуги, заявени за имота. */
export const GET = withAuth({ role: ["admin", "client"] }, async (_request, { session, params }) => {
  const property = db.select().from(properties).where(eq(properties.id, params.id)).get();
  if (!property || !canViewProperty(session, property)) {
    return NextResponse.json({ error: "Имотът не е намерен" }, { status: 404 });
  }
  const rows = db
    .select({ order: serviceOrders, template_name: serviceTemplates.name })
    .from(serviceOrders)
    .innerJoin(serviceTemplates, eq(serviceOrders.template_id, serviceTemplates.id))
    .where(eq(serviceOrders.property_id, property.id))
    .orderBy(desc(serviceOrders.created_at))
    .all();
  const pendingMethod = (orderId: string) =>
    db
      .select({ method: payments.method })
      .from(payments)
      .where(and(eq(payments.order_id, orderId), eq(payments.status, "pending")))
      .get()?.method ?? null;
  return NextResponse.json(
    rows.map((r) => ({
      ...r.order,
      template_name: r.template_name,
      pay_method: r.order.status === "pending_payment" ? pendingMethod(r.order.id) : null,
    })),
  );
});

/**
 * POST — еднократна допълнителна услуга (уточнение 6б).
 * Body: { template_id, date: "YYYY-MM-DD", note?, method: "card" | "bank" }
 * Цената идва от услугата. Карта → Stripe; банка → чака потвърждение.
 */
export const POST = withAuth({ role: ["client"] }, async (request, { session, params }) => {
  try {
    const property = db.select().from(properties).where(eq(properties.id, params.id)).get();
    if (!property || property.owner_id !== session.uid) {
      return NextResponse.json({ error: "Имотът не е намерен" }, { status: 404 });
    }
    if (property.status !== "active" || property.archived) {
      return NextResponse.json({ error: "Услуги се заявяват след одобрение на имота" }, { status: 409 });
    }

    const body = await request.json().catch(() => ({}));
    const template = typeof body.template_id === "string"
      ? db.select().from(serviceTemplates).where(eq(serviceTemplates.id, body.template_id)).get()
      : undefined;
    if (!template || template.archived || !template.bookable || !(Number(template.price) > 0)) {
      return NextResponse.json({ error: "Изберете услуга от списъка" }, { status: 400 });
    }

    const today = todaySofia();
    const date = typeof body.date === "string" ? body.date.slice(0, 10) : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date <= today || date > addDays(today, 60)) {
      return NextResponse.json({ error: "Изберете дата от утре до 60 дни напред" }, { status: 400 });
    }
    const method = body.method === "bank" ? "bank" : "card";
    const price = Number(template.price);
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;

    const [order] = db
      .insert(serviceOrders)
      .values({ property_id: property.id, template_id: template.id, requested_by: session.uid, requested_date: date, note, price })
      .returning()
      .all();
    const [payment] = db
      .insert(payments)
      .values({ user_id: session.uid, order_id: order.id, amount: price, method, status: "pending" })
      .returning()
      .all();

    if (method === "bank") {
      const vars = { property: property.name, service: template.name, date: formatDateOnly(date) };
      await notify("order_new_team", { to: "admins", vars });
      await notify("bank_transfer_details", {
        to: session.uid,
        vars: { amount: formatMoney(price), what: `${template.name} — ${property.name}, ${formatDateOnly(date)}` },
        rows: bankRows(bankReference("order", order.id), price),
      });
      return NextResponse.json({ ...order, payment_id: payment.id, bank: true }, { status: 201 });
    }

    const stripe = getStripeOrNull();
    if (!stripe) {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Плащането с карта не е настроено. Изберете превод." }, { status: 503 });
      }
      // Локално без Stripe — симулирано плащане, същият път като webhook-а.
      await settleServiceOrder({ orderId: order.id, paymentId: payment.id, method: "card" });
      return NextResponse.json({ ...order, status: "paid", mock: true }, { status: 201 });
    }
    if (!validateStripeAmount(price)) {
      return NextResponse.json({ error: "Сумата е под минимума за карта" }, { status: 400 });
    }

    const customer = await ensureStripeCustomer(stripe, session.uid);
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      customer,
      client_reference_id: payment.id,
      metadata: { payment_id: payment.id, kind: "order", order_id: order.id },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: eurToCents(price),
            product_data: { name: `${template.name} — ${property.name}`, description: `Дата: ${date}` },
          },
        },
      ],
      success_url: `${appUrl()}/dashboard?payment=order-ok`,
      cancel_url: `${appUrl()}/dashboard?payment=order-cancel`,
      locale: "bg",
    });
    db.update(payments).set({ stripe_session_id: checkout.id }).where(eq(payments.id, payment.id)).run();
    return NextResponse.json({ ...order, checkout_url: checkout.url }, { status: 201 });
  } catch (error) {
    console.error("POST orders error:", error);
    return NextResponse.json({ error: "Грешка при заявката" }, { status: 500 });
  }
});
