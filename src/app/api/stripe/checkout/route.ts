import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { db } from "@/db";
import { payments, offers, findings, properties } from "@/db/schema";
import { canDecideOffer } from "@/lib/auth";
import { canTransition, type OfferDecision } from "@/lib/domain/offers";
import { eq } from "drizzle-orm";
import { validateStripeAmount, eurToCents, getStripeOrNull } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/checkout
 * Body: { offerId }
 *
 * Плащане по оферта. Сумата, собственикът и статусът идват от базата, НЕ от
 * тялото на заявката — иначе клиент плаща 0.50 € за оферта от 5000 €.
 */
export const POST = withAuth({ role: ["client"] }, async (request, { session }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const offerId: unknown = body?.offerId;

    if (typeof offerId !== "string" || !offerId) {
      return NextResponse.json({ error: "Липсва оферта" }, { status: 400 });
    }

    const row = db
      .select({ offer: offers, owner_id: properties.owner_id })
      .from(offers)
      .innerJoin(findings, eq(offers.finding_id, findings.id))
      .innerJoin(properties, eq(findings.property_id, properties.id))
      .where(eq(offers.id, offerId))
      .get();

    if (!row || !canDecideOffer(session, { owner_id: row.owner_id })) {
      return NextResponse.json({ error: "Офертата не е намерена" }, { status: 404 });
    }

    const offer = row.offer;
    if (!canTransition(offer.decision as OfferDecision, "paid", offer.price)) {
      return NextResponse.json(
        { error: "Тази оферта не чака плащане" },
        { status: 409 },
      );
    }

    const amount = Number(offer.price ?? 0);
    const currency = "eur";
    const plan = "";
    const propertyId = "";

    if (!validateStripeAmount(amount)) {
      return NextResponse.json(
        { error: "Минималната сума за плащане с карта е 0.50 €" },
        { status: 400 }
      );
    }

    const appUrl =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://comanda.bg";

    const stripe = getStripeOrNull();

    if (!stripe && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Плащането с карта не е настроено. Моля, платете по банков път." },
        { status: 503 },
      );
    }

    // Само при локална разработка без Stripe ключ — симулирано плащане.
    if (!stripe) {
      const paymentId = crypto.randomUUID();
      db.insert(payments)
        .values({
          id: paymentId,
          user_id: session.uid,
          offer_id: offerId || null,
          amount,
          method: "card",
          status: "paid",
          paid_at: new Date().toISOString(),
        })
        .run();

      return NextResponse.json({
        url: `${appUrl}/dashboard/payment/success?payment_id=${paymentId}&amount=${amount}`,
        sessionId: null,
        paymentId,
        mock: true,
      });
    }

    // Създай payment запис първо
    const paymentId = crypto.randomUUID();
    db.insert(payments)
      .values({
        id: paymentId,
        user_id: session.uid,
        offer_id: offerId || null,
        amount,
        status: "pending",
        method: "card",
      })
      .run();

    // Създай Stripe Checkout Session
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      client_reference_id: paymentId,
      metadata: {
        payment_id: paymentId,
        plan: plan || "",
        propertyId: propertyId || "",
        offerId: offerId || "",
        user_id: session.uid,
      },
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: plan
                ? `План: ${plan}`
                : offerId
                  ? `Плащане по оферта #${offerId.slice(0, 8)}`
                  : `Плащане към Ко Манда`,
              description: plan
                ? `Абонаментен план ${plan}`
                : offerId
                  ? `Изпълнение на ремонтна дейност`
                  : `Еднократно плащане`,
            },
            unit_amount: eurToCents(amount),
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/dashboard/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard/payment/cancel`,
    });

    // Ъпдейтни payment записа със Stripe session_id
    db.update(payments)
      .set({ stripe_session_id: stripeSession.id })
      .where(eq(payments.id, paymentId))
      .run();

    return NextResponse.json({
      url: stripeSession.url,
      sessionId: stripeSession.id,
      paymentId,
    });
  } catch (error: any) {
    console.error("[stripe/checkout] Error:", error);
    return NextResponse.json(
      {
        error:
          "Грешка при създаване на Stripe сесия: " + (error.message || ""),
      },
      { status: 500 }
    );
  }
});
