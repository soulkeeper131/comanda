import { db } from "@/db";
import { payments, invoices, offers, findings, properties, users, settings, plans, serviceOrders, serviceTemplates } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { canTransition, offerPrepay, type OfferDecision } from "@/lib/domain/offers";
import { getPrepayThreshold } from "@/lib/settings";
import { formatEur } from "@/lib/mail-layout";
import { notify, propertyLink } from "@/lib/messages";
import { invoiceAttachment } from "@/lib/messages/attachments";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Поредният номер на фактура — 10 цифри, без пропуски (както го изисква
 * законът за фактурите). Брояч в settings, увеличаван в същата транзакция
 * като самата фактура — неуспешен запис не оставя дупка в номерацията.
 */
function allocateInvoiceNumber(tx: Tx): string {
  const row = tx.select().from(settings).where(eq(settings.key, "invoice_seq")).get();
  const next = (row ? Number(row.value) : 0) + 1;
  if (row) tx.update(settings).set({ value: String(next) }).where(eq(settings.key, "invoice_seq")).run();
  else tx.insert(settings).values({ key: "invoice_seq", value: String(next) }).run();
  return String(next).padStart(10, "0");
}

export function nextInvoiceNumber(): string {
  return db.transaction((tx) => allocateInvoiceNumber(tx));
}

/** Данните на купувача към момента — пазят се във фактурата. */
function buyerSnapshot(userId: string) {
  const u = db.select().from(users).where(eq(users.id, userId)).get();
  return {
    buyer_name: u?.full_name ?? null,
    buyer_email: u?.email ?? null,
    buyer_company: u?.company_name ?? null,
    buyer_eik: u?.eik ?? null,
    buyer_vat: u?.vat_number ?? null,
    buyer_address: u?.billing_address ?? null,
  };
}

/** Основанието на плащане — за фактурата и за опашката на админа. */
export function describePayment(paymentId: string): string {
  const p = db.select().from(payments).where(eq(payments.id, paymentId)).get();
  if (!p) return "Плащане";
  if (p.offer_id) {
    const r = db
      .select({ title: findings.title, property: properties.name })
      .from(offers)
      .innerJoin(findings, eq(offers.finding_id, findings.id))
      .innerJoin(properties, eq(findings.property_id, properties.id))
      .where(eq(offers.id, p.offer_id))
      .get();
    return r ? `Ремонт: ${r.title} — ${r.property}` : "Ремонт";
  }
  if (p.order_id) {
    const r = db
      .select({ name: serviceTemplates.name, property: properties.name })
      .from(serviceOrders)
      .innerJoin(serviceTemplates, eq(serviceOrders.template_id, serviceTemplates.id))
      .innerJoin(properties, eq(serviceOrders.property_id, properties.id))
      .where(eq(serviceOrders.id, p.order_id))
      .get();
    return r ? `Допълнителна услуга: ${r.name} — ${r.property}` : "Допълнителна услуга";
  }
  if (p.plan_id) {
    const r = db
      .select({ name: plans.name, property: properties.name, paid_until: plans.paid_until })
      .from(plans)
      .innerJoin(properties, eq(plans.property_id, properties.id))
      .where(eq(plans.id, p.plan_id))
      .get();
    return r ? `Абонамент ${r.name} — ${r.property}` : "Абонамент";
  }
  return "Плащане";
}

/**
 * Фактура към плащане — най-много една на плащане (и уникален индекс в
 * базата). Идемпотентна: повторно извикване връща съществуващата, така че
 * всеки повторен webhook може спокойно да я поиска.
 */
export function ensureInvoice(paymentId: string, description?: string) {
  const existing = db.select().from(invoices).where(eq(invoices.payment_id, paymentId)).get();
  if (existing) return existing;
  const payment = db.select().from(payments).where(eq(payments.id, paymentId)).get();
  if (!payment || payment.status !== "paid") return null;
  const values = {
    user_id: payment.user_id,
    payment_id: paymentId,
    amount: payment.amount,
    description: description || describePayment(paymentId),
    ...buyerSnapshot(payment.user_id),
  };
  try {
    return db.transaction((tx) => tx.insert(invoices).values({ ...values, number: allocateInvoiceNumber(tx) }).returning().get());
  } catch (err) {
    // Паралелно извикване я е създало междувременно (уникален индекс).
    const again = db.select().from(invoices).where(eq(invoices.payment_id, paymentId)).get();
    if (again) return again;
    throw err;
  }
}

/**
 * Кредитно известие при върнато плащане — сторнира фактурата с отрицателна
 * сума и собствен пореден номер. Идемпотентно.
 */
export function issueCreditNote(paymentId: string) {
  const original = db.select().from(invoices).where(eq(invoices.payment_id, paymentId)).get();
  if (!original) return null;
  const existing = db.select().from(invoices).where(eq(invoices.credit_for, original.id)).get();
  if (existing) return existing;
  return db.transaction((tx) =>
    tx
      .insert(invoices)
      .values({
        user_id: original.user_id,
        number: allocateInvoiceNumber(tx),
        amount: -(original.amount ?? 0),
        description: `Кредитно известие към фактура ${original.number}: ${original.description ?? ""}`,
        credit_for: original.id,
        buyer_name: original.buyer_name,
        buyer_email: original.buyer_email,
        buyer_company: original.buyer_company,
        buyer_eik: original.buyer_eik,
        buyer_vat: original.buyer_vat,
        buyer_address: original.buyer_address,
      })
      .returning()
      .get(),
  );
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
      await notify("refund_needed_team", {
        to: "admins",
        vars: { reason: `Двойно плащане: ${finding.title} (${property.name})`, amount: formatEur(offer.price) },
      });
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

  const owner = db.select({ email: users.email, name: users.full_name }).from(users).where(eq(users.id, property.owner_id)).get();
  const vars = { amount: formatEur(offer.price), title: finding.title, property: property.name, client: owner?.name ?? owner?.email ?? "" };
  const rows: [string, string | null | undefined][] = [
    ["Начин", opts.method === "card" ? "Карта" : "Банков превод"],
    ["Фактура", invoice?.number],
  ];
  await notify("payment_received", {
    to: property.owner_id,
    vars,
    rows,
    link: propertyLink(property.id),
    attachments: invoiceAttachment(invoice?.id),
  });
  await notify("payment_received_team", { to: "admins", vars, rows });
  return { ok: true, invoiceNumber: invoice?.number ?? null };
}
