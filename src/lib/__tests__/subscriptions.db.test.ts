import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Stripe from "stripe";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "komanda-sub-"));
fs.cpSync(path.join(process.cwd(), "drizzle"), path.join(dir, "drizzle"), { recursive: true });
process.chdir(dir);

let db: typeof import("@/db")["db"];
let s: typeof import("@/db/schema");
let subs: typeof import("@/lib/subscriptions");
let pay: typeof import("@/lib/payments");
let eq: typeof import("drizzle-orm")["eq"];

const plan = () => db.select().from(s.plans).where(eq(s.plans.id, "pl")).get()!;

beforeAll(async () => {
  ({ db } = await import("@/db"));
  s = await import("@/db/schema");
  subs = await import("@/lib/subscriptions");
  pay = await import("@/lib/payments");
  ({ eq } = await import("drizzle-orm"));
  db.insert(s.organizations).values({ id: "o", name: "K" }).run();
  db.insert(s.users).values({ id: "c", org_id: "o", email: "c@x.bg", password_hash: "x", role: "client" }).run();
  db.insert(s.properties).values({ id: "p", org_id: "o", owner_id: "c", name: "Имот", lat: 1, lng: 1, status: "active" }).run();
  db.insert(s.serviceTemplates).values({ id: "t", org_id: "o", category: "inspection", name: "Обход" }).run();
  db.insert(s.plans).values({ id: "pl", property_id: "p", template_id: "t", name: "Пълен надзор", per_month: 2, price: 60, status: "pending_payment" }).run();
});

const invoice = (id: string, amount = 6000, periodEnd = 1793491200) =>
  ({
    id,
    amount_paid: amount,
    amount_due: amount,
    period_end: periodEnd,
    parent: { subscription_details: { subscription: "sub_1" } },
    lines: { data: [{ period: { end: periodEnd } }] },
  }) as unknown as Stripe.Invoice;

describe("Stripe абонамент", () => {
  it("първото плащане → чака насрочване", async () => {
    await subs.onSubscriptionCheckoutCompleted({
      mode: "subscription",
      subscription: "sub_1",
      client_reference_id: "pl",
      metadata: { plan_id: "pl" },
    } as unknown as Stripe.Checkout.Session);
    expect(plan().status).toBe("requested");
    expect(plan().stripe_subscription_id).toBe("sub_1");
  });

  it("всяко месечно плащане → плащане + фактура, веднъж", async () => {
    await subs.onInvoicePaid(invoice("in_1"));
    await subs.onInvoicePaid(invoice("in_1")); // повторено събитие
    const payments = db.select().from(s.payments).all();
    expect(payments).toHaveLength(1);
    expect(payments[0].amount).toBe(60);
    const invs = db.select().from(s.invoices).all();
    expect(invs).toHaveLength(1);
    expect(invs[0].number).toBe("0000000001");
    expect(plan().paid_until).toBe("2026-11-01");
  });

  it("неуспешно плащане → past_due", async () => {
    await subs.onInvoicePaymentFailed(invoice("in_2"));
    expect(plan().stripe_status).toBe("past_due");
  });

  it("отказ в края на периода → прекратен до края на платеното", async () => {
    db.update(s.plans).set({ status: "active", first_job_at: "2026-10-01" }).where(eq(s.plans.id, "pl")).run();
    await subs.onSubscriptionChanged(
      { id: "sub_1", status: "active", cancel_at_period_end: true, items: { data: [{ current_period_end: 1793491200 }] }, metadata: {} } as unknown as Stripe.Subscription,
      false,
    );
    expect(plan().status).toBe("cancelled");
    expect(plan().ends_at).toBe("2026-11-01");
  });

  it("поредни номера на фактури", () => {
    expect(pay.nextInvoiceNumber()).toBe("0000000002");
    expect(pay.nextInvoiceNumber()).toBe("0000000003");
  });
});

describe("плащане на оферта", () => {
  beforeAll(() => {
    db.insert(s.findings).values({ id: "f", org_id: "o", property_id: "p", title: "Теч" }).run();
    db.insert(s.offers).values({ id: "of", finding_id: "f", price: 180, decision: "accepted", requires_prepayment: true }).run();
  });

  it("банков превод, после и карта → второто е за връщане, една фактура", async () => {
    db.insert(s.payments).values({ id: "bank", user_id: "c", offer_id: "of", amount: 180, method: "bank", status: "pending" }).run();
    db.insert(s.payments).values({ id: "card", user_id: "c", offer_id: "of", amount: 180, method: "card", status: "pending" }).run();

    const first = await pay.settleOfferPayment({ offerId: "of", method: "bank" }); // админ потвърждава превода
    expect(first.ok).toBe(true);
    const bank = db.select().from(s.payments).where(eq(s.payments.id, "bank")).get()!;
    expect(bank.status).toBe("paid");

    const second = await pay.settleOfferPayment({ offerId: "of", paymentId: "card", method: "card" });
    expect(second).toEqual({ ok: false, reason: "duplicate" });
    expect(db.select().from(s.payments).where(eq(s.payments.id, "card")).get()!.status).toBe("refund_needed");
    expect(db.select().from(s.invoices).where(eq(s.invoices.payment_id, "card")).all()).toHaveLength(0);
    expect(db.select().from(s.offers).where(eq(s.offers.id, "of")).get()!.decision).toBe("paid");
  });
});
