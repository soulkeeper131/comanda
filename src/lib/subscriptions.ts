import type Stripe from "stripe";
import { db } from "@/db";
import { plans, properties, users, payments } from "@/db/schema";
import { and, eq, inArray, isNull, lte } from "drizzle-orm";
import { getStripeOrNull, eurToCents } from "@/lib/stripe";
import { appUrl, formatEur } from "@/lib/mail-layout";
import { bankRows, notify, propertyLink } from "@/lib/messages";
import { invoiceAttachment } from "@/lib/messages/attachments";
import { ensureInvoice } from "@/lib/payments";
import { removePlannedJobsAfter, todaySofia } from "@/lib/jobs-generator";
import { addDays, billingPeriod } from "@/lib/domain/plans";
import { getBankDetails } from "@/lib/settings";
import { bankReference, formatDateOnly } from "@/lib/format";

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

  // Отворена страница за плащане от преди — същата, не втора (иначе два
  // платени таба = два абонамента, от които единият тегли без план).
  if (plan.stripe_checkout_session_id) {
    try {
      const old = await stripe.checkout.sessions.retrieve(plan.stripe_checkout_session_id);
      if (old.status === "open" && old.url) return old.url;
    } catch {
      /* изтекла или изтрита — правим нова */
    }
  }

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
  db.update(plans).set({ stripe_checkout_session_id: session.id }).where(eq(plans.id, plan.id)).run();
  return session.url;
}

/**
 * Затваря отворената страница за плащане на плана — при отказ, при нова
 * заявка за имота или при плащане по банка. Иначе стар таб може да бъде
 * платен по-късно и да пусне абонамент без план.
 */
export async function expirePlanCheckout(planId: string) {
  const stripe = getStripeOrNull();
  const plan = db.select().from(plans).where(eq(plans.id, planId)).get();
  if (!stripe || !plan?.stripe_checkout_session_id) return;
  try {
    const session = await stripe.checkout.sessions.retrieve(plan.stripe_checkout_session_id);
    if (session.status === "open") await stripe.checkout.sessions.expire(session.id);
  } catch (err) {
    console.error("[subscriptions] expire checkout failed:", err);
  }
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

function paymentIntentOfInvoice(invoice: Stripe.Invoice): string | null {
  const pi = invoice.payments?.data?.[0]?.payment?.payment_intent;
  if (!pi) return null;
  return typeof pi === "string" ? pi : pi.id;
}

function subscriptionIdOfInvoice(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

/**
 * Абонамент в Stripe се закача за плана само ако планът още чака плащане и
 * няма друг абонамент. Всичко друго (стар таб, втори таб, отказан или вече
 * платен по банка план) е пари без услуга — абонаментът се спира и сумата
 * отива за връщане.
 */
function canAttach(plan: typeof plans.$inferSelect, subscriptionId: string) {
  if (plan.stripe_subscription_id) return plan.stripe_subscription_id === subscriptionId;
  return plan.status === "pending_payment";
}

async function attachSubscription(plan: typeof plans.$inferSelect, subscriptionId: string) {
  const wasPending = plan.status === "pending_payment";
  db.transaction((tx) => {
    tx.update(plans)
      .set({
        stripe_subscription_id: subscriptionId,
        stripe_status: "active",
        stripe_checkout_session_id: null,
        status: wasPending ? "requested" : plan.status,
      })
      .where(eq(plans.id, plan.id))
      .run();
    // Заявен превод за същия месец вече няма смисъл.
    tx.update(payments)
      .set({ status: "cancelled" })
      .where(and(eq(payments.plan_id, plan.id), eq(payments.status, "pending"), eq(payments.method, "bank")))
      .run();
  });
  if (wasPending) await announcePlanRequested(plan.id);
}

async function rejectOrphanSubscription(plan: typeof plans.$inferSelect, subscriptionId: string, session: Stripe.Checkout.Session) {
  const stripe = getStripeOrNull();
  try {
    await stripe?.subscriptions.cancel(subscriptionId);
  } catch (err) {
    console.error("[subscriptions] cancel orphan failed:", err);
  }
  const property = db.select().from(properties).where(eq(properties.id, plan.property_id)).get();
  const seen = db.select().from(payments).where(eq(payments.stripe_session_id, session.id)).get();
  if (!seen && property) {
    db.insert(payments)
      .values({
        user_id: property.owner_id,
        plan_id: plan.id,
        amount: (session.amount_total ?? 0) / 100,
        method: "card",
        status: "refund_needed",
        stripe_session_id: session.id,
      })
      .run();
  }
  await notify("refund_needed_team", {
    to: "admins",
    vars: {
      reason: `Плащане за абонамент, който не чака плащане (${property?.name ?? ""} — ${plan.name}); абонаментът в Stripe е спрян`,
      amount: formatEur((session.amount_total ?? 0) / 100),
    },
  });
}

/** Първото плащане е минало → планът чака админа да насрочи първия обход. */
export async function onSubscriptionCheckoutCompleted(session: Stripe.Checkout.Session) {
  const planId = session.metadata?.plan_id || session.client_reference_id;
  if (!planId) return;
  const plan = db.select().from(plans).where(eq(plans.id, planId)).get();
  if (!plan) return;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
  if (!subscriptionId) return;

  if (canAttach(plan, subscriptionId)) await attachSubscription(plan, subscriptionId);
  else await rejectOrphanSubscription(plan, subscriptionId, session);
}

/** Известие до екипа — нов платен абонамент чака насрочване. */
export async function announcePlanRequested(planId: string) {
  const plan = db.select().from(plans).where(eq(plans.id, planId)).get();
  const property = plan && db.select().from(properties).where(eq(properties.id, plan.property_id)).get();
  if (!plan || !property) return;
  const owner = db.select({ name: users.full_name, phone: users.phone, email: users.email }).from(users).where(eq(users.id, property.owner_id)).get();
  await notify("plan_to_schedule", {
    to: "admins",
    vars: { property: property.name, package: plan.name },
    rows: [
      ["Адрес", property.address],
      ["Месечно", formatEur(plan.price)],
      ["Клиент", [owner?.name, owner?.phone, owner?.email].filter(Boolean).join(", ")],
      ["Контакт на място", [property.contact_name, property.contact_phone].filter(Boolean).join(", ")],
    ],
  });
}

/** Всяко месечно теглене → плащане + фактура; платено до края на периода. */
export async function onInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = subscriptionIdOfInvoice(invoice);
  if (!subscriptionId || !invoice.id) return;
  // Stripe не гарантира реда на събитията: invoice.paid често идва преди
  // checkout.session.completed. Тогава планът се намира по metadata.
  let plan = planBySubscription(subscriptionId);
  if (!plan) {
    const metaPlanId = invoice.parent?.subscription_details?.metadata?.plan_id;
    const byMeta = metaPlanId ? db.select().from(plans).where(eq(plans.id, metaPlanId)).get() : undefined;
    if (!byMeta || !canAttach(byMeta, subscriptionId)) return; // сирак — checkout.completed ще го спре
    await attachSubscription(byMeta, subscriptionId);
    plan = db.select().from(plans).where(eq(plans.id, byMeta.id)).get();
  }
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
      plan_id: plan.id,
      amount: invoice.amount_paid / 100,
      status: "paid",
      method: "card",
      stripe_session_id: invoice.id,
      stripe_payment_intent_id: paymentIntentOfInvoice(invoice),
      paid_at: new Date().toISOString(),
    })
    .returning()
    .all();
  const inv = ensureInvoice(payment.id, `Абонамент ${plan.name} — ${property.name}, до ${unixToDate(periodEnd) ?? ""}`);

  db.update(plans)
    .set({ paid_until: unixToDate(periodEnd), stripe_status: "active" })
    .where(eq(plans.id, plan.id))
    .run();

  await notify("plan_paid", {
    to: property.owner_id,
    vars: { amount: formatEur(payment.amount), package: plan.name, property: property.name, paid_until: formatDateOnly(unixToDate(periodEnd)) },
    rows: [["Фактура", inv?.number]],
    link: propertyLink(property.id),
    attachments: invoiceAttachment(inv?.id),
  });
}

/** Неуспешно теглене — Stripe опитва пак ~7 дни; екипът и клиентът знаят. */
export async function onInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = subscriptionIdOfInvoice(invoice);
  if (!subscriptionId) return;
  const plan = planBySubscription(subscriptionId);
  const property = plan && db.select().from(properties).where(eq(properties.id, plan.property_id)).get();
  if (!plan || !property) return;
  db.update(plans).set({ stripe_status: "past_due" }).where(eq(plans.id, plan.id)).run();

  const vars = { property: property.name, amount: formatEur(invoice.amount_due / 100) };
  await notify("plan_payment_failed_team", { to: "admins", vars });
  await notify("plan_payment_failed", { to: property.owner_id, vars, link: propertyLink(property.id) });
}

/**
 * Промяна по абонамента в Stripe — отказ до края на периода, изтриване
 * (след изчерпани опити за плащане или отказ от таблото на Stripe).
 */
export async function onSubscriptionChanged(sub: Stripe.Subscription, deleted: boolean) {
  // Само по закачения абонамент: спрян „сирак" не бива да отказва плана,
  // за който е бил платен погрешка.
  const plan = planBySubscription(sub.id);
  if (!plan) return;
  const periodEnd = unixToDate(sub.items?.data?.[0]?.current_period_end);

  // Отказан преди първия обход (ends_at = null): спирането в Stripe е
  // следствие от отказа — датата не се сменя на „днес".
  if (deleted && plan.status === "cancelled" && !plan.ends_at) {
    db.update(plans).set({ stripe_status: sub.status }).where(eq(plans.id, plan.id)).run();
    return;
  }

  if (deleted || sub.cancel_at_period_end) {
    const today = todaySofia();
    const endsAt = deleted ? today : periodEnd ?? today;
    if (plan.status !== "cancelled" || plan.ends_at !== endsAt) {
      // Спрян от страната на Stripe (изчерпани опити за плащане, портал,
      // таблото на Stripe) — не от приложението: клиентът и екипът трябва
      // да разберат, иначе обходите просто изчезват.
      const fromStripe = plan.status !== "cancelled";
      if (fromStripe) {
        const property = db.select().from(properties).where(eq(properties.id, plan.property_id)).get();
        if (property) {
          const outcome = deleted
            ? "абонаментът е спрян след неуспешни плащания с картата. Обходите след днес са махнати; можете да заявите пакет отново."
            : `абонаментът е прекратен и важи до ${formatDateOnly(endsAt)}.`;
          await notify("plan_cancelled", { to: property.owner_id, vars: { property: property.name, outcome }, link: propertyLink(property.id) });
          await notify("plan_cancelled_team", { to: "admins", vars: { property: property.name, outcome: deleted ? "спрян от Stripe (неуспешни плащания)" : `прекратен през Stripe, важи до ${formatDateOnly(endsAt)}` } });
        }
      }
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

// ============================================================
// Абонамент по банков превод: плащане за всеки месец, потвърдено от админа
// ============================================================

/** Чакащ превод за плана — създава се, ако няма. */
export function requestPlanBankPayment(planId: string) {
  const plan = db.select().from(plans).where(eq(plans.id, planId)).get();
  const property = plan && db.select().from(properties).where(eq(properties.id, plan.property_id)).get();
  if (!plan || !property) return null;
  const pending = db
    .select()
    .from(payments)
    .where(and(eq(payments.plan_id, plan.id), eq(payments.status, "pending"), eq(payments.method, "bank")))
    .get();
  if (pending) return pending;
  return db
    .insert(payments)
    .values({ user_id: property.owner_id, plan_id: plan.id, amount: plan.price ?? 0, method: "bank", status: "pending" })
    .returning()
    .get();
}

/**
 * Потвърден превод за абонамент: плаща един месец напред от платеното
 * досега; заявката отива при админа за насрочване; фактура.
 */
export async function settlePlanPayment(paymentId: string): Promise<{ ok: true; invoiceNumber: string | null } | { ok: false; error: string }> {
  const payment = db.select().from(payments).where(eq(payments.id, paymentId)).get();
  const plan = payment?.plan_id ? db.select().from(plans).where(eq(plans.id, payment.plan_id)).get() : undefined;
  const property = plan && db.select().from(properties).where(eq(properties.id, plan.property_id)).get();
  if (!payment || !plan || !property) return { ok: false, error: "Плащането не е намерено" };
  if (payment.status !== "pending") return { ok: false, error: "Плащането не чака потвърждение" };
  if (plan.status === "cancelled" && !plan.ends_at) {
    return { ok: false, error: "Абонаментът е отказан преди първия обход — откажете превода и върнете сумата" };
  }

  const period = billingPeriod(plan.paid_until, todaySofia());
  const wasPending = plan.status === "pending_payment";
  db.transaction((tx) => {
    tx.update(payments).set({ status: "paid", paid_at: new Date().toISOString() }).where(eq(payments.id, payment.id)).run();
    tx.update(plans)
      .set({ paid_until: period.until, ...(wasPending ? { status: "requested" as const } : {}) })
      .where(eq(plans.id, plan.id))
      .run();
  });
  if (wasPending) await expirePlanCheckout(plan.id);

  const inv = ensureInvoice(
    payment.id,
    `Абонамент ${plan.name} — ${property.name}, ${formatDateOnly(period.from)}–${formatDateOnly(period.until)}`,
  );
  await notify("plan_paid", {
    to: property.owner_id,
    vars: { amount: formatEur(payment.amount), package: plan.name, property: property.name, paid_until: formatDateOnly(period.until) },
    rows: [["Фактура", inv?.number]],
    link: propertyLink(property.id),
    attachments: invoiceAttachment(inv?.id),
  });
  if (wasPending) await announcePlanRequested(plan.id);
  return { ok: true, invoiceNumber: inv?.number ?? null };
}

/**
 * Периодична задача: 7 дни преди края на платения месец клиентите, които
 * плащат по банка, получават превод за следващия месец с данните за плащане.
 * Идемпотентна — втори чакащ превод за същия план не се създава.
 */
export async function billBankPlans(today: string = todaySofia()): Promise<number> {
  const due = db
    .select()
    .from(plans)
    .where(
      and(
        inArray(plans.status, ["requested", "active"]),
        isNull(plans.stripe_subscription_id),
        isNull(plans.ends_at),
        lte(plans.paid_until, addDays(today, 7)),
      ),
    )
    .all();
  let created = 0;
  for (const plan of due) {
    const hadPending = db
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.plan_id, plan.id), eq(payments.status, "pending")))
      .get();
    if (hadPending) continue;
    const payment = requestPlanBankPayment(plan.id);
    const property = db.select().from(properties).where(eq(properties.id, plan.property_id)).get();
    if (!payment || !property) continue;
    created++;
    await notify("plan_next_payment", {
      to: property.owner_id,
      vars: { paid_until: formatDateOnly(plan.paid_until), amount: formatEur(plan.price), package: plan.name, property: property.name },
      rows: bankRows(bankReference("plan", plan.id), plan.price),
      link: propertyLink(property.id),
    });
  }
  return created;
}
