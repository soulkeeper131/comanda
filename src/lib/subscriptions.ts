import type Stripe from "stripe";
import { db } from "@/db";
import { plans, properties, users, payments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getStripeOrNull, eurToCents } from "@/lib/stripe";
import { appUrl, emailLayout, formatEur } from "@/lib/mail-layout";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { sendEmail, getNotifyEmail } from "@/lib/email";
import { ensureInvoice } from "@/lib/payments";
import { removePlannedJobsAfter, todaySofia } from "@/lib/jobs-generator";

/**
 * Абонаментите през Stripe (N9, въпроси 4 и 5): клиентът плаща при заявката,
 * после Stripe тегли всеки месец. Отказът важи до края на платения период.
 */

const unixToDate = (s: number | null | undefined) => (s ? new Date(s * 1000).toISOString().slice(0, 10) : null);

/** Stripe клиент за потребителя — създава се веднъж и се пази. */
export async function ensureStripeCustomer(stripe: Stripe, userId: string): Promise<string> {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) throw new Error("user not found");
  if (user.stripe_customer_id) return user.stripe_customer_id;
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.company_name || user.full_name || undefined,
    phone: user.phone || undefined,
    metadata: { user_id: user.id },
  });
  db.update(users).set({ stripe_customer_id: customer.id }).where(eq(users.id, user.id)).run();
  return customer.id;
}

/**
 * Checkout за нов абонамент. Цената идва от плана (т.е. от пакета), не от
 * клиента; Stripe създава месечния абонамент при успешно плащане.
 */
export async function createSubscriptionCheckout(planId: string, userId: string): Promise<string | null> {
  const stripe = getStripeOrNull();
  if (!stripe) return null;
  const plan = db.select().from(plans).where(eq(plans.id, planId)).get();
  const property = plan && db.select().from(properties).where(eq(properties.id, plan.property_id)).get();
  if (!plan || !property) throw new Error("plan not found");

  const customer = await ensureStripeCustomer(stripe, userId);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: plan.id,
    metadata: { plan_id: plan.id, kind: "plan" },
    subscription_data: { metadata: { plan_id: plan.id } },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: eurToCents(plan.price ?? 0),
          recurring: { interval: "month" },
          product_data: { name: `${plan.name} — ${property.name}` },
        },
      },
    ],
    success_url: `${appUrl()}/dashboard?payment=plan-ok`,
    cancel_url: `${appUrl()}/dashboard?payment=plan-cancel`,
    locale: "bg",
  });
  return session.url;
}

/** Страницата на Stripe, където клиентът сменя карта и вижда плащанията си. */
export async function createPortalSession(userId: string): Promise<string | null> {
  const stripe = getStripeOrNull();
  if (!stripe) return null;
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user?.stripe_customer_id) return null;
  const portal = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: `${appUrl()}/dashboard`,
  });
  return portal.url;
}

function planBySubscription(subscriptionId: string) {
  return db.select().from(plans).where(eq(plans.stripe_subscription_id, subscriptionId)).get();
}

function subscriptionIdOfInvoice(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

/** Първото плащане е минало → планът чака админа да насрочи първия обход. */
export async function onSubscriptionCheckoutCompleted(session: Stripe.Checkout.Session) {
  const planId = session.metadata?.plan_id || session.client_reference_id;
  if (!planId) return;
  const plan = db.select().from(plans).where(eq(plans.id, planId)).get();
  if (!plan) return;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;

  db.update(plans)
    .set({
      stripe_subscription_id: subscriptionId,
      stripe_status: "active",
      status: plan.status === "pending_payment" ? "requested" : plan.status,
    })
    .where(eq(plans.id, plan.id))
    .run();

  if (plan.status === "pending_payment") await announcePlanRequested(plan.id);
}

/** Известие до екипа — нов платен абонамент чака насрочване. */
export async function announcePlanRequested(planId: string) {
  const plan = db.select().from(plans).where(eq(plans.id, planId)).get();
  const property = plan && db.select().from(properties).where(eq(properties.id, plan.property_id)).get();
  if (!plan || !property) return;
  notifyAdmins("plan_requested", "Нов абонамент чака насрочване", `${property.name} — ${plan.name}`, "/dashboard");
  sendEmail({
    to: (await getNotifyEmail()) || "",
    subject: `Нов абонамент: ${property.name} — ${plan.name}`,
    html: emailLayout({
      title: "Нов абонамент чака насрочване",
      intro: "Обадете се на клиента и насрочете първия обход.",
      rows: [
        ["Имот", property.name],
        ["Адрес", property.address],
        ["Пакет", plan.name],
        ["Месечно", formatEur(plan.price)],
        ["Контакт", [property.contact_name, property.contact_phone].filter(Boolean).join(", ")],
      ],
      cta: { label: "Насрочи" },
    }),
  }).catch(() => {});
}

/** Всяко месечно теглене → плащане + фактура; платено до края на периода. */
export async function onInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = subscriptionIdOfInvoice(invoice);
  if (!subscriptionId || !invoice.id) return;
  const plan = planBySubscription(subscriptionId);
  if (!plan) return;
  const property = db.select().from(properties).where(eq(properties.id, plan.property_id)).get();
  if (!property) return;

  // Идемпотентност: Stripe може да прати събитието повече от веднъж.
  const seen = db.select().from(payments).where(eq(payments.stripe_session_id, invoice.id)).get();
  if (seen) return;

  const periodEnd = invoice.lines?.data?.[0]?.period?.end ?? invoice.period_end;
  const [payment] = db
    .insert(payments)
    .values({
      user_id: property.owner_id,
      amount: invoice.amount_paid / 100,
      status: "paid",
      method: "card",
      stripe_session_id: invoice.id,
      paid_at: new Date().toISOString(),
    })
    .returning()
    .all();
  const inv = ensureInvoice(payment.id, `Абонамент ${plan.name} — ${property.name}, до ${unixToDate(periodEnd) ?? ""}`);

  db.update(plans)
    .set({ paid_until: unixToDate(periodEnd), stripe_status: "active" })
    .where(eq(plans.id, plan.id))
    .run();

  createNotification(
    property.owner_id,
    "offer_decided",
    "Абонаментът е платен",
    `${formatEur(payment.amount)} — ${plan.name}${inv ? ` · фактура ${inv.number}` : ""}`,
    "/dashboard",
  );
}

/** Неуспешно теглене — Stripe опитва пак ~7 дни; екипът и клиентът знаят. */
export async function onInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = subscriptionIdOfInvoice(invoice);
  if (!subscriptionId) return;
  const plan = planBySubscription(subscriptionId);
  const property = plan && db.select().from(properties).where(eq(properties.id, plan.property_id)).get();
  if (!plan || !property) return;
  db.update(plans).set({ stripe_status: "past_due" }).where(eq(plans.id, plan.id)).run();

  notifyAdmins("plan_requested", "Неуспешно теглене на абонамент", `${property.name} — ${formatEur(invoice.amount_due / 100)}`, "/dashboard");
  createNotification(property.owner_id, "plan_scheduled", "Плащането на абонамента не мина", "Обновете картата от Профил → Карта и плащания.", "/dashboard");
  const owner = db.select({ email: users.email }).from(users).where(eq(users.id, property.owner_id)).get();
  if (owner?.email) {
    sendEmail({
      to: owner.email,
      subject: "Плащането на абонамента не мина",
      html: emailLayout({
        title: "Плащането не мина",
        intro: "Банката отказа месечното плащане. Ще опитаме отново през следващите дни — обновете картата, за да не спират обходите.",
        rows: [
          ["Имот", property.name],
          ["Сума", formatEur(invoice.amount_due / 100)],
        ],
        color: "#d97706",
        cta: { label: "Обнови картата" },
      }),
    }).catch(() => {});
  }
}

/**
 * Промяна по абонамента в Stripe — отказ до края на периода, изтриване
 * (след изчерпани опити за плащане или отказ от таблото на Stripe).
 */
export async function onSubscriptionChanged(sub: Stripe.Subscription, deleted: boolean) {
  const plan = planBySubscription(sub.id) ?? (sub.metadata?.plan_id ? db.select().from(plans).where(eq(plans.id, sub.metadata.plan_id)).get() : undefined);
  if (!plan) return;
  const periodEnd = unixToDate(sub.items?.data?.[0]?.current_period_end);

  if (deleted || sub.cancel_at_period_end) {
    const today = todaySofia();
    const endsAt = deleted ? today : periodEnd ?? today;
    if (plan.status !== "cancelled" || plan.ends_at !== endsAt) {
      db.transaction((tx) => {
        tx.update(plans)
          .set({
            status: "cancelled",
            stripe_status: sub.status,
            cancelled_at: plan.cancelled_at ?? new Date().toISOString(),
            ends_at: endsAt,
          })
          .where(eq(plans.id, plan.id))
          .run();
        removePlannedJobsAfter(plan.id, endsAt, tx);
      });
    }
    return;
  }

  // Отказът е оттеглен (от портала) — планът продължава.
  db.update(plans)
    .set({
      stripe_status: sub.status,
      ...(plan.status === "cancelled" && plan.first_job_at ? { status: "active" as const, ends_at: null, cancelled_at: null } : {}),
    })
    .where(eq(plans.id, plan.id))
    .run();
}

/**
 * Отказ от приложението: при Stripe — `cancel_at_period_end`, краят идва от
 * Stripe; без Stripe — края на месеца. Връща датата, до която важи.
 */
export async function cancelStripeSubscription(planId: string, immediately: boolean): Promise<string | null> {
  const stripe = getStripeOrNull();
  const plan = db.select().from(plans).where(eq(plans.id, planId)).get();
  if (!stripe || !plan?.stripe_subscription_id) return null;
  if (immediately) {
    await stripe.subscriptions.cancel(plan.stripe_subscription_id);
    return todaySofia();
  }
  const sub = await stripe.subscriptions.update(plan.stripe_subscription_id, { cancel_at_period_end: true });
  return unixToDate(sub.items?.data?.[0]?.current_period_end) ?? plan.paid_until ?? todaySofia();
}
