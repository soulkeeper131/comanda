import { NextResponse } from "next/server";
import { db } from "@/db";
import { payments, offers, invoices, users } from "@/db/schema";
import { getWebhookSecret, getStripe } from "@/lib/stripe";
import { eq } from "drizzle-orm";
import { sendEmail, getNotifyEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/webhook
 *
 * Обработва Stripe webhook събития:
 * - checkout.session.completed → маркира payment като paid, създава invoice, ъпдейтва offer
 *
 * Важно: тялото се чете като raw text (не JSON), за да може Stripe
 * да верифицира сигнатурата.
 */
// @public Stripe вика този endpoint отвън; защитен е с подпис в тялото (constructEvent), не със сесия.
export async function POST(request: Request) {
  const webhookSecret = getWebhookSecret();

  if (!webhookSecret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const stripe = getStripe();

  // Чети raw body за верификация на сигнатурата
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error(`[stripe/webhook] Signature verification failed:`, err.message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err.message}` },
      { status: 400 }
    );
  }

  // Обработка на събития
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      }

      case "checkout.session.expired": {
        await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        console.error(`[stripe/webhook] Payment failed for intent: ${intent.id}`);
        break;
      }

      default:
        console.log(`[stripe/webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error(`[stripe/webhook] Error handling event ${event.type}:`, error);
    return NextResponse.json(
      { error: "Internal error processing webhook" },
      { status: 500 }
    );
  }
}

/**
 * Обработва успешно завършен checkout:
 * 1. Намира payment по client_reference_id (payment_id)
 * 2. Ъпдейтва payment.status = "paid"
 * 3. Записва stripe_payment_intent_id
 * 4. Ако payment е свързан с offer → ъпдейтва offer.decision: accepted→paid→in_progress
 * 5. Създава invoice запис
 * 6. Изпраща нотификации
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const paymentId = session.client_reference_id || session.metadata?.payment_id;

  if (!paymentId) {
    console.error("[stripe/webhook] No payment_id in session", session.id);
    return;
  }

  // Намери payment записа
  const payment = db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .get();

  if (!payment) {
    console.error(`[stripe/webhook] Payment not found: ${paymentId}`);
    return;
  }

  // Вече обработено (идемпотентност)
  if (payment.status === "paid") {
    console.log(`[stripe/webhook] Payment ${paymentId} already paid, skipping`);
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;

  const now = new Date().toISOString();

  // 1. Ъпдейт payment
  db.update(payments)
    .set({
      status: "paid",
      paid_at: now,
      stripe_payment_intent_id: paymentIntentId,
      stripe_session_id: session.id, // ensure session_id is set
    })
    .where(eq(payments.id, paymentId))
    .run();

  console.log(`[stripe/webhook] Payment ${paymentId} marked as paid`);

  // 2. Ако има offer_id → ъпдейтвай offer flow
  if (payment.offer_id) {
    const offer = db
      .select()
      .from(offers)
      .where(eq(offers.id, payment.offer_id))
      .get();

    if (offer && offer.decision === "accepted") {
      db.update(offers)
        .set({ decision: "paid" })
        .where(eq(offers.id, payment.offer_id))
        .run();

      console.log(
        `[stripe/webhook] Offer ${payment.offer_id} decision → paid`
      );
    }
  }

  // 3. Създай invoice
  const user = db
    .select({ full_name: users.full_name, email: users.email })
    .from(users)
    .where(eq(users.id, payment.user_id))
    .get();

  const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}-${paymentId.slice(0, 4).toUpperCase()}`;
  const description = payment.offer_id
    ? `Плащане по оферта #${payment.offer_id.slice(0, 8)}`
    : `Плащане през Stripe`;

  db.insert(invoices)
    .values({
      id: crypto.randomUUID(),
      user_id: payment.user_id,
      payment_id: paymentId,
      number: invoiceNumber,
      amount: payment.amount,
      description,
    })
    .run();

  console.log(`[stripe/webhook] Invoice ${invoiceNumber} created`);

  // 4. Нотификации
  const userName = user?.full_name || user?.email || "Клиент";

  // In-app нотификация за owner-а на payment-a
  createNotification(
    payment.user_id,
    "offer_decided",
    "✅ Плащането е успешно",
    `Плащане от ${payment.amount.toFixed(2)}€ е обработено успешно. Фактура: ${invoiceNumber}`,
    "/dashboard/payments"
  );

  // Email нотификация
  const notifyEmail = await getNotifyEmail();
  if (notifyEmail && user?.email) {
    sendEmail({
      to: notifyEmail,
      subject: `💰 Ново плащане: ${payment.amount.toFixed(2)}€ от ${userName}`,
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;background:#e8f1f2;border-radius:12px">
          <h2 style="color:#006494">💰 Ново плащане</h2>
          <p style="color:#247ba0"><strong>Клиент:</strong> ${userName}</p>
          <p style="color:#247ba0"><strong>Сума:</strong> ${payment.amount.toFixed(2)}€</p>
          <p style="color:#247ba0"><strong>Фактура:</strong> ${invoiceNumber}</p>
          ${payment.offer_id ? `<p style="color:#247ba0"><strong>Оферта:</strong> #${payment.offer_id.slice(0, 8)}</p>` : ""}
          <hr style="border:none;border-top:1px solid #e4e9f0;margin:20px 0" />
          <p style="color:#94a3b8;font-size:12px">Ко Манда — comanda.blv.bg</p>
        </div>
      `,
    }).catch(() => {});

    // Изпрати и на клиента
    sendEmail({
      to: user.email,
      subject: `✅ Плащането от ${payment.amount.toFixed(2)}€ е потвърдено`,
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;background:#e8f1f2;border-radius:12px">
          <h2 style="color:#16a34a">✅ Плащането е успешно</h2>
          <p style="color:#247ba0">Благодарим ви! Плащането от <strong>${payment.amount.toFixed(2)}€</strong> е обработено успешно.</p>
          <p style="color:#247ba0"><strong>Фактура:</strong> ${invoiceNumber}</p>
          <p style="color:#247ba0">Можете да изтеглите фактурата от таблото си.</p>
          <a href="https://comanda.blv.bg/dashboard/payments" style="display:inline-block;padding:12px 24px;background:#1b98e0;color:#fff;border-radius:8px;text-decoration:none;margin-top:12px">Към таблото</a>
          <hr style="border:none;border-top:1px solid #e4e9f0;margin:20px 0" />
          <p style="color:#94a3b8;font-size:12px">Ко Манда — comanda.blv.bg</p>
        </div>
      `,
    }).catch(() => {});
  }
}

/**
 * Обработва expired checkout сесия → маркира payment като cancelled
 */
async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
  const paymentId = session.client_reference_id || session.metadata?.payment_id;

  if (!paymentId) return;

  const payment = db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .get();

  if (!payment || payment.status !== "pending") return;

  db.update(payments)
    .set({ status: "cancelled" })
    .where(eq(payments.id, paymentId))
    .run();

  console.log(`[stripe/webhook] Payment ${paymentId} marked as cancelled (session expired)`);
}
