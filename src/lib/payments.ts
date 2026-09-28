import { db } from "@/db";
import { payments, invoices, offers, findings, properties, users, settings } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { canTransition, offerPrepay, type OfferDecision } from "@/lib/domain/offers";
import { getPrepayThreshold } from "@/lib/settings";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { sendEmail, getNotifyEmail } from "@/lib/email";
import { emailLayout, formatEur } from "@/lib/mail-layout";

/**
 * Поредният номер на фактура — 10 цифри, без пропуски (както го изисква
 * законът за фактурите). Брояч в settings, увеличаван атомарно.
 */
export function nextInvoiceNumber(): string {
  return db.transaction((tx) => {
    const row = tx.select().from(settings).where(eq(settings.key, "invoice_seq")).get();
    const next = (row ? Number(row.value) : 0) + 1;
    if (row) tx.update(settings).set({ value: String(next) }).where(eq(settings.key, "invoice_seq")).run();
    else tx.insert(settings).values({ key: "invoice_seq", value: String(next) }).run();
    return String(next).padStart(10, "0");
  });
}

/** Фактура към плащане — най-много една на плащане. */
export function ensureInvoice(paymentId: string, description: string) {
  const existing = db.select().from(invoices).where(eq(invoices.payment_id, paymentId)).get();
  if (existing) return existing;
  const payment = db.select().from(payments).where(eq(payments.id, paymentId)).get();
  if (!payment) return null;
  const [inv] = db
    .insert(invoices)
    .values({
      user_id: payment.user_id,
      payment_id: paymentId,
      number: nextInvoiceNumber(),
      amount: payment.amount,
      description,
    })
    .returning()
    .all();
  return inv;
}

/** Има ли вече плащане по офертата, което чака или е минало. */
export function liveOfferPayment(offerId: string) {
  return db
    .select()
    .from(payments)
    .where(and(eq(payments.offer_id, offerId), inArray(payments.status, ["pending", "paid"])))
    .all();
}

export type SettleResult =
  | { ok: true; invoiceNumber: string | null }
  | { ok: false; reason: "not_found" | "not_payable" | "duplicate" };

/**
 * Отбелязва оферта като платена — едно място за Stripe, банков превод и
 * ръчно потвърждение от админ.
 *
 * - Ако има чакащо плащане по банка, то се потвърждава (не се създава второ).
 * - Ако офертата вече не чака плащане (платена е по друг път), новото
 *   плащане се маркира `refund_needed` и админите се уведомяват —
 *   без втора фактура и без тихо „платено".
 */
export async function settleOfferPayment(opts: {
  offerId: string;
  /** Плащането, което е дошло (Stripe сесия); без него — ръчно от админ. */
  paymentId?: string;
  method: "card" | "bank";
  stripe?: { session_id?: string | null; payment_intent_id?: string | null };
}): Promise<SettleResult> {
  const row = db
    .select({ offer: offers, finding: findings, property: properties })
    .from(offers)
    .innerJoin(findings, eq(offers.finding_id, findings.id))
    .innerJoin(properties, eq(findings.property_id, properties.id))
    .where(eq(offers.id, opts.offerId))
    .get();
  if (!row) return { ok: false, reason: "not_found" };
  const { offer, finding, property } = row;
  const now = new Date().toISOString();
  const prepay = offerPrepay(offer, getPrepayThreshold());

  if (!canTransition(offer.decision as OfferDecision, "paid", prepay)) {
    if (opts.paymentId) {
      db.update(payments)
        .set({
          status: "refund_needed",
          stripe_session_id: opts.stripe?.session_id ?? undefined,
          stripe_payment_intent_id: opts.stripe?.payment_intent_id ?? undefined,
        })
        .where(eq(payments.id, opts.paymentId))
        .run();
      notifyAdmins(
        "offer_decided",
        "Двойно плащане — нужно е възстановяване",
        `${property.name}: ${finding.title} (${formatEur(offer.price)}) е платена повторно.`,
        "/dashboard",
      );
      return { ok: false, reason: "duplicate" };
    }
    return { ok: false, reason: "not_payable" };
  }

  const paymentId = db.transaction((tx) => {
    let id = opts.paymentId;
    if (!id) {
      // Ръчно от админ: потвърждава заявения превод, ако има такъв.
      const pending = tx
        .select()
        .from(payments)
        .where(and(eq(payments.offer_id, offer.id), eq(payments.status, "pending")))
        .get();
      if (pending) id = pending.id;
      else {
        const [created] = tx
          .insert(payments)
          .values({ user_id: property.owner_id, offer_id: offer.id, amount: offer.price ?? 0, method: opts.method, status: "pending" })
          .returning()
          .all();
        id = created.id;
      }
    }
    tx.update(payments)
      .set({
        status: "paid",
        paid_at: now,
        method: opts.method,
        stripe_session_id: opts.stripe?.session_id ?? undefined,
        stripe_payment_intent_id: opts.stripe?.payment_intent_id ?? undefined,
      })
      .where(eq(payments.id, id))
      .run();
    // Останалите чакащи плащания по офертата вече нямат смисъл.
    tx.update(payments)
      .set({ status: "cancelled" })
      .where(and(eq(payments.offer_id, offer.id), eq(payments.status, "pending")))
      .run();
    tx.update(offers).set({ decision: "paid", paid_at: now }).where(eq(offers.id, offer.id)).run();
    return id;
  });

  const invoice = ensureInvoice(paymentId, `Ремонт: ${finding.title} — ${property.name}`);

  createNotification(
    property.owner_id,
    "offer_decided",
    "Плащането е получено",
    `${formatEur(offer.price)} — ${finding.title}${invoice ? ` · фактура ${invoice.number}` : ""}`,
    "/dashboard",
  );
  const owner = db.select({ email: users.email, name: users.full_name }).from(users).where(eq(users.id, property.owner_id)).get();
  const html = emailLayout({
    title: "Плащането е получено",
    rows: [
      ["Имот", property.name],
      ["За", finding.title],
      ["Сума", formatEur(offer.price)],
      ["Начин", opts.method === "card" ? "Карта" : "Банков превод"],
      ["Фактура", invoice?.number],
    ],
    color: "#16a34a",
    cta: { label: "Фактурата е в Профил" },
  });
  if (owner?.email) sendEmail({ to: owner.email, subject: `Плащането за ${finding.title} е получено`, html }).catch(() => {});
  const notify = await getNotifyEmail();
  if (notify) {
    sendEmail({ to: notify, subject: `Плащане ${formatEur(offer.price)} — ${property.name} (${owner?.name ?? owner?.email ?? ""})`, html }).catch(() => {});
  }
  return { ok: true, invoiceNumber: invoice?.number ?? null };
}
