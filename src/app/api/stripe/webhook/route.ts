import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/db";
import { payments, serviceOrders } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getWebhookSecret, eurToCents } from "@/lib/stripe";
import { ensureInvoice, settleOfferPayment } from "@/lib/payments";
import { onChargeRefunded } from "@/lib/refunds";
import { notifyAdmins } from "@/lib/notifications";
import { settleServiceOrder } from "@/lib/service-orders";
import {
  onInvoicePaid,
  onInvoicePaymentFailed,
  onSubscriptionChanged,
  onSubscriptionCheckoutCompleted,
} from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/webhook — събитията от Stripe.
 *
 *   checkout.session.completed    плащане по оферта / първо плащане по абонамент
 *   checkout.session.expired      изоставено плащане по оферта / услуга
 *   charge.refunded               върнато от таблото на Stripe → кредитно известие
 *   invoice.paid                  месечно теглене → плащане + фактура
 *   invoice.payment_failed        неуспешно теглене → предупреждение
 *   customer.subscription.updated отказ до края на периода / оттеглен отказ
 *   customer.subscription.deleted абонаментът е спрян
 *
 * Тялото се чете като текст, за да се провери подписът (constructEvent).
 */
// @public Stripe вика този endpoint отвън; защитен е с подпис в тялото (constructEvent), не със сесия.
export async function POST(request: Request) {
  const webhookSecret = getWebhookSecret();
  if (!webhookSecret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });

  let event: Stripe.Event;
  try {
    // Проверката на подписа е локална — не иска API ключ.
    event = Stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe/webhook] Signature verification failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription") await onSubscriptionCheckoutCompleted(session);
        else await onOfferCheckoutCompleted(session);
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentId = session.client_reference_id || session.metadata?.payment_id;
        if (session.mode === "payment" && paymentId) {
          const payment = db.select().from(payments).where(eq(payments.id, paymentId)).get();
          if (payment?.status === "pending") {
            db.update(payments).set({ status: "cancelled" }).where(eq(payments.id, paymentId)).run();
            // Изоставена услуга не виси „чака плащане" завинаги — клиентът я заявява пак.
            if (payment.order_id) {
              db.update(serviceOrders)
                .set({ status: "cancelled" })
                .where(and(eq(serviceOrders.id, payment.order_id), eq(serviceOrders.status, "pending_payment")))
                .run();
            }
          }
        }
        break;
      }
      case "charge.refunded":
        onChargeRefunded(event.data.object as Stripe.Charge);
        break;
      case "invoice.paid":
        await onInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await onInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case "customer.subscription.updated":
        await onSubscriptionChanged(event.data.object as Stripe.Subscription, false);
        break;
      case "customer.subscription.deleted":
        await onSubscriptionChanged(event.data.object as Stripe.Subscription, true);
        break;
      default:
        break;
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`[stripe/webhook] Error handling ${event.type}:`, error);
    // 500 → Stripe ще опита пак; обработчиците са идемпотентни.
    return NextResponse.json({ error: "Internal error processing webhook" }, { status: 500 });
  }
}

/** Плащане с карта по оферта или за допълнителна услуга. Сумата се сверява с тази, която Stripe е събрал. */
async function onOfferCheckoutCompleted(session: Stripe.Checkout.Session) {
  const paymentId = session.client_reference_id || session.metadata?.payment_id;
  if (!paymentId) return;
  const payment = db.select().from(payments).where(eq(payments.id, paymentId)).get();
  if (!payment || (!payment.offer_id && !payment.order_id)) return;
  if (payment.status === "paid") {
    // Повторено събитие — само фактурата, ако първия път не е станала.
    ensureInvoice(payment.id);
    return;
  }

  if (session.payment_status !== "paid") return;
  const paymentIntent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  if (session.amount_total !== eurToCents(payment.amount)) {
    // Взети са пари, но не колкото трябва — не се приема тихо.
    console.error(`[stripe/webhook] Amount mismatch for payment ${paymentId}: ${session.amount_total} vs ${eurToCents(payment.amount)}`);
    db.update(payments)
      .set({ status: "refund_needed", stripe_session_id: session.id, stripe_payment_intent_id: paymentIntent })
      .where(eq(payments.id, payment.id))
      .run();
    notifyAdmins("offer_decided", "Плащане с грешна сума — върнете го", `Взети ${(session.amount_total ?? 0) / 100} € вместо ${payment.amount} €`, "/dashboard");
    return;
  }


  if (payment.order_id) {
    await settleServiceOrder({
      orderId: payment.order_id,
      paymentId: payment.id,
      method: "card",
      stripe: { session_id: session.id, payment_intent_id: paymentIntent },
    });
    return;
  }
  await settleOfferPayment({
    offerId: payment.offer_id!,
    paymentId: payment.id,
    method: "card",
    stripe: { session_id: session.id, payment_intent_id: paymentIntent },
  });
}
