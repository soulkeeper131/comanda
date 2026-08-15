import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateStripeAmount, eurToCents } from "@/lib/stripe";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

// Lazy Stripe init — избягва build error когато ключът липсва
function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const StripeSDK = require("stripe");
  return new StripeSDK(key);
}

/**
 * POST /api/stripe/checkout
 * Body: { plan?, propertyId?, offerId?, amount, currency? }
 *
 * Създава Stripe Checkout Session и връща URL + sessionId + paymentId.
 * Записва payment запис в DB със status="pending" и stripe_session_id.
 */
export const POST = withAuth({}, async (request, { session }) => {
  try {
    const body = await request.json().catch(() => ({}));
    let { plan, propertyId, offerId, amount, currency } = body;

    amount = parseFloat(amount);
    currency = currency || "eur";

    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Сумата е задължителна и трябва да е положителна" },
        { status: 400 }
      );
    }

    if (!validateStripeAmount(amount)) {
      return NextResponse.json(
        { error: "Минималната сума за Stripe плащане е 0.50€" },
        { status: 400 }
      );
    }

    const appUrl =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://comanda.blv.bg";

    const stripe = getStripe();

    // Ако Stripe не е конфигуриран — dev fallback: директно маркираме като платено
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
