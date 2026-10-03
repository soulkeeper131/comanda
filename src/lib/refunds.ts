import type Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobReschedules, jobs, payments, serviceOrders } from "@/db/schema";
import { getStripeOrNull } from "@/lib/stripe";
import { describePayment, issueCreditNote } from "@/lib/payments";
import { notify } from "@/lib/messages";
import { invoiceAttachment } from "@/lib/messages/attachments";
import { formatEur } from "@/lib/mail-layout";

/** PaymentIntent зад плащането — нужен е, за да се върнат парите в Stripe. */
async function paymentIntentOf(stripe: Stripe, p: typeof payments.$inferSelect): Promise<string | null> {
  if (p.stripe_payment_intent_id) return p.stripe_payment_intent_id;
  const ref = p.stripe_session_id;
  if (!ref) return null;
  let invoiceId: string | null = null;
  if (ref.startsWith("cs_")) {
    const session = await stripe.checkout.sessions.retrieve(ref);
    const pi = session.payment_intent;
    if (pi) return typeof pi === "string" ? pi : pi.id;
    invoiceId = typeof session.invoice === "string" ? session.invoice : session.invoice?.id ?? null;
  } else if (ref.startsWith("in_")) {
    invoiceId = ref;
  }
  if (!invoiceId) return null;
  const list = await stripe.invoicePayments.list({ invoice: invoiceId, limit: 1 });
  const pi = list.data[0]?.payment?.payment_intent;
  return pi ? (typeof pi === "string" ? pi : pi.id) : null;
}

/**
 * Отбелязва плащането като върнато: кредитно известие към фактурата, а
 * платена допълнителна услуга се отменя (обходът ѝ се маха, ако не е почнал).
 * Идемпотентно — вика се и от бутона, и от webhook-а charge.refunded.
 */
export function markRefunded(paymentId: string) {
  const payment = db.select().from(payments).where(eq(payments.id, paymentId)).get();
  if (!payment || payment.status === "refunded") return;
  const wasPaid = payment.status === "paid";
  db.update(payments).set({ status: "refunded" }).where(eq(payments.id, payment.id)).run();
  const credit = issueCreditNote(payment.id);

  if (wasPaid && payment.order_id) {
    const order = db.select().from(serviceOrders).where(eq(serviceOrders.id, payment.order_id)).get();
    db.transaction((tx) => {
      tx.update(serviceOrders).set({ status: "cancelled" }).where(eq(serviceOrders.id, payment.order_id!)).run();
      if (order?.job_id) {
        const job = tx.select().from(jobs).where(eq(jobs.id, order.job_id)).get();
        if (job?.status === "planned") {
          tx.delete(jobReschedules).where(eq(jobReschedules.job_id, job.id)).run();
          tx.update(serviceOrders).set({ job_id: null }).where(eq(serviceOrders.id, payment.order_id!)).run();
          tx.delete(jobs).where(and(eq(jobs.id, job.id), eq(jobs.status, "planned"))).run();
        }
      }
    });
  }
  void notify("refund_done", {
    to: payment.user_id,
    vars: {
      amount: formatEur(payment.amount),
      what: describePayment(payment.id),
      how:
        payment.method === "card"
          ? "Сумата ще се появи в картата ви до 5–10 работни дни."
          : "Преведохме сумата по сметката, от която сте платили.",
    },
    rows: [["Кредитно известие", credit?.number]],
    attachments: invoiceAttachment(credit?.id),
  });
}

/**
 * Бутонът „Върни": за плащане с карта връща парите през Stripe (ключ за
 * идемпотентност — двойно натискане не връща два пъти), за банков превод
 * админът е превел сам и само го отбелязва.
 */
export async function refundPayment(paymentId: string): Promise<{ ok: true; viaStripe: boolean } | { ok: false; error: string }> {
  const payment = db.select().from(payments).where(eq(payments.id, paymentId)).get();
  if (!payment) return { ok: false, error: "Плащането не е намерено" };
  if (payment.status !== "paid" && payment.status !== "refund_needed") {
    return { ok: false, error: "Това плащане не може да се върне" };
  }
  const stripe = getStripeOrNull();
  let viaStripe = false;
  if (payment.method === "card" && stripe && (payment.stripe_payment_intent_id || payment.stripe_session_id)) {
    try {
      const pi = await paymentIntentOf(stripe, payment);
      if (!pi) return { ok: false, error: "Не намерихме плащането в Stripe — върнете го от таблото на Stripe" };
      await stripe.refunds.create({ payment_intent: pi }, { idempotencyKey: `refund-${payment.id}` });
      if (!payment.stripe_payment_intent_id) {
        db.update(payments).set({ stripe_payment_intent_id: pi }).where(eq(payments.id, payment.id)).run();
      }
      viaStripe = true;
    } catch (err) {
      console.error("[refunds] Stripe refund failed:", err);
      const msg = err instanceof Error && /already been refunded/i.test(err.message) ? null : "Stripe не прие връщането — опитайте пак";
      if (msg) return { ok: false, error: msg };
    }
  }
  markRefunded(payment.id);
  return { ok: true, viaStripe };
}

/** Webhook charge.refunded — върнато от таблото на Stripe. */
export function onChargeRefunded(charge: Stripe.Charge) {
  if (!charge.refunded) return; // частично връщане — оставяме на админа
  const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!pi) return;
  const payment = db.select().from(payments).where(eq(payments.stripe_payment_intent_id, pi)).get();
  if (payment) markRefunded(payment.id);
}
