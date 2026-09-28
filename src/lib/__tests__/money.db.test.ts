import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Stripe from "stripe";

// Парите от прегледа: банков абонамент, ред на събитията в Stripe, сираци,
// отказ преди първия обход, оттеглена платена услуга, фактури и връщания.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "komanda-money-"));
fs.cpSync(path.join(process.cwd(), "drizzle"), path.join(dir, "drizzle"), { recursive: true });
process.chdir(dir);

let db: typeof import("@/db")["db"];
let s: typeof import("@/db/schema");
let subs: typeof import("@/lib/subscriptions");
let pay: typeof import("@/lib/payments");
let cancel: typeof import("@/lib/plan-cancel");
let orders: typeof import("@/lib/service-orders");
let refunds: typeof import("@/lib/refunds");
let jobsGen: typeof import("@/lib/jobs-generator");
let eq: typeof import("drizzle-orm")["eq"];

const planRow = (id: string) => db.select().from(s.plans).where(eq(s.plans.id, id)).get()!;
const paymentsOf = (planId: string) => db.select().from(s.payments).where(eq(s.payments.plan_id, planId)).all();

beforeAll(async () => {
  ({ db } = await import("@/db"));
  s = await import("@/db/schema");
  subs = await import("@/lib/subscriptions");
  pay = await import("@/lib/payments");
  cancel = await import("@/lib/plan-cancel");
  orders = await import("@/lib/service-orders");
  refunds = await import("@/lib/refunds");
  jobsGen = await import("@/lib/jobs-generator");
  ({ eq } = await import("drizzle-orm"));
  db.insert(s.organizations).values({ id: "o", name: "K" }).run();
  db.insert(s.users).values([
    { id: "c", org_id: "o", email: "c@x.bg", password_hash: "x", role: "client", full_name: "Иван" },
    { id: "a", org_id: "o", email: "a@x.bg", password_hash: "x", role: "admin" },
  ]).run();
  db.insert(s.properties).values([
    { id: "p1", org_id: "o", owner_id: "c", name: "Имот 1", lat: 1, lng: 1, status: "active" },
    { id: "p2", org_id: "o", owner_id: "c", name: "Имот 2", lat: 1, lng: 1, status: "active" },
    { id: "p3", org_id: "o", owner_id: "c", name: "Имот 3", lat: 1, lng: 1, status: "active" },
  ]).run();
  db.insert(s.serviceTemplates).values({ id: "t", org_id: "o", category: "inspection", name: "Обход", price: 40 }).run();
  db.insert(s.plans).values([
    { id: "bank", property_id: "p1", template_id: "t", name: "Пълен надзор", per_month: 2, price: 60, status: "pending_payment" },
    { id: "card", property_id: "p2", template_id: "t", name: "Зимен", per_month: 2, price: 40, status: "pending_payment" },
    { id: "stale", property_id: "p3", template_id: "t", name: "Летен", per_month: 2, price: 50, status: "cancelled" },
  ]).run();
});

const session = (planId: string, sub: string, id = `cs_${sub}`) =>
  ({ id, mode: "subscription", subscription: sub, client_reference_id: planId, metadata: { plan_id: planId }, amount_total: 4000 }) as unknown as Stripe.Checkout.Session;
const invoice = (id: string, sub: string, planId: string) =>
  ({
    id,
    amount_paid: 4000,
    amount_due: 4000,
    period_end: 1793491200,
    parent: { subscription_details: { subscription: sub, metadata: { plan_id: planId } } },
    lines: { data: [{ period: { end: 1793491200 } }] },
  }) as unknown as Stripe.Invoice;

describe("абонамент по банка", () => {
  it("заявка → чакащ превод; потвърден → заявен, платен месец, фактура със снимка на купувача", async () => {
    const p = subs.requestPlanBankPayment("bank")!;
    expect(subs.requestPlanBankPayment("bank")!.id).toBe(p.id); // не се дублира
    const res = await subs.settlePlanPayment(p.id);
    expect(res.ok).toBe(true);
    const plan = planRow("bank");
    expect(plan.status).toBe("requested");
    expect(plan.paid_until).not.toBeNull();
    const inv = db.select().from(s.invoices).where(eq(s.invoices.payment_id, p.id)).get()!;
    expect(inv.buyer_name).toBe("Иван");
    expect(inv.description).toContain("Абонамент Пълен надзор");
  });

  it("7 дни преди края → превод за следващия месец, веднъж", async () => {
    const paidUntil = planRow("bank").paid_until!;
    db.update(s.plans).set({ status: "active" }).where(eq(s.plans.id, "bank")).run();
    const day = jobsGen.todaySofia(new Date(new Date(paidUntil).getTime() - 5 * 86400000));
    expect(await subs.billBankPlans(day)).toBe(1);
    expect(await subs.billBankPlans(day)).toBe(0);
    const pending = paymentsOf("bank").filter((x) => x.status === "pending");
    expect(pending).toHaveLength(1);
    await subs.settlePlanPayment(pending[0].id);
    // следващият месец продължава без дупка
    expect(planRow("bank").paid_until! > paidUntil).toBe(true);
  });
});

describe("Stripe: ред на събитията и сираци", () => {
  it("invoice.paid преди checkout.completed не губи първото плащане", async () => {
    await subs.onInvoicePaid(invoice("in_c1", "sub_c", "card"));
    expect(planRow("card").stripe_subscription_id).toBe("sub_c");
    expect(planRow("card").status).toBe("requested");
    expect(paymentsOf("card").filter((p) => p.status === "paid")).toHaveLength(1);
    await subs.onSubscriptionCheckoutCompleted(session("card", "sub_c"));
    expect(planRow("card").stripe_subscription_id).toBe("sub_c");
  });

  it("втори платен таб не пренаписва абонамента — отива за връщане", async () => {
    await subs.onSubscriptionCheckoutCompleted(session("card", "sub_c2"));
    expect(planRow("card").stripe_subscription_id).toBe("sub_c");
    const refund = paymentsOf("card").filter((p) => p.status === "refund_needed");
    expect(refund).toHaveLength(1);
    expect(refund[0].amount).toBe(40);
    // месечното му плащане не се записва като платено
    await subs.onInvoicePaid(invoice("in_c2", "sub_c2", "card"));
    expect(paymentsOf("card").filter((p) => p.status === "paid")).toHaveLength(1);
  });

  it("платен стар таб на отказан план не го съживява", async () => {
    await subs.onInvoicePaid(invoice("in_s1", "sub_s", "stale"));
    await subs.onSubscriptionCheckoutCompleted(session("stale", "sub_s"));
    expect(planRow("stale").status).toBe("cancelled");
    expect(planRow("stale").stripe_subscription_id).toBeNull();
    expect(paymentsOf("stale").map((p) => p.status)).toEqual(["refund_needed"]);
  });

  it("спряният сирак не отказва истинския абонамент", async () => {
    await subs.onSubscriptionChanged({ id: "sub_c2", status: "canceled", items: { data: [] }, metadata: { plan_id: "card" } } as unknown as Stripe.Subscription, true);
    expect(planRow("card").status).toBe("requested");
  });
});

describe("отказ преди първия обход", () => {
  it("без завършен обход → спира веднага, платеното отива за връщане", async () => {
    const res = await cancel.cancelPlan("bank", { byAdmin: false });
    expect(res.ok && res.endsAt).toBeNull();
    expect(res.ok && res.refund).toBe(120);
    expect(planRow("bank").ends_at).toBeNull();
    expect(paymentsOf("bank").every((p) => p.status === "refund_needed")).toBe(true);
  });
});

describe("допълнителна услуга", () => {
  it("оттеглена и после платена с карта → за връщане, без обход", async () => {
    db.insert(s.serviceOrders).values({ id: "so", property_id: "p1", template_id: "t", requested_by: "c", requested_date: "2099-01-01", price: 40, status: "cancelled" }).run();
    db.insert(s.payments).values({ id: "sop", user_id: "c", order_id: "so", amount: 40, method: "card", status: "cancelled" }).run();
    const res = await orders.settleServiceOrder({ orderId: "so", paymentId: "sop", method: "card", stripe: { session_id: "cs_so" } });
    expect(res.ok).toBe(false);
    expect(db.select().from(s.payments).where(eq(s.payments.id, "sop")).get()!.status).toBe("refund_needed");
    expect(db.select().from(s.jobs).all()).toHaveLength(0);
  });

  it("платена услуга, после върната → кредитно известие и обходът се маха", async () => {
    db.insert(s.serviceOrders).values({ id: "so2", property_id: "p1", template_id: "t", requested_by: "c", requested_date: "2099-02-01", price: 40 }).run();
    db.insert(s.payments).values({ id: "so2p", user_id: "c", order_id: "so2", amount: 40, method: "bank", status: "pending" }).run();
    await orders.settleServiceOrder({ orderId: "so2", paymentId: "so2p", method: "bank" });
    expect(db.select().from(s.jobs).all()).toHaveLength(1);
    const res = await refunds.refundPayment("so2p");
    expect(res.ok).toBe(true);
    expect(db.select().from(s.jobs).all()).toHaveLength(0);
    const inv = db.select().from(s.invoices).where(eq(s.invoices.payment_id, "so2p")).get()!;
    const credit = db.select().from(s.invoices).where(eq(s.invoices.credit_for, inv.id)).get()!;
    expect(credit.amount).toBe(-40);
    refunds.markRefunded("so2p"); // идемпотентно
    expect(db.select().from(s.invoices).where(eq(s.invoices.credit_for, inv.id)).all()).toHaveLength(1);
  });
});

describe("фактури", () => {
  it("номерата са поредни и без повторения; една фактура на плащане", () => {
    const nums = db.select().from(s.invoices).all().map((i) => i.number).sort();
    expect(new Set(nums).size).toBe(nums.length);
    expect(Number(nums[nums.length - 1])).toBe(nums.length);
    const first = db.select().from(s.invoices).all().find((i) => i.payment_id)!;
    expect(pay.ensureInvoice(first.payment_id!)!.id).toBe(first.id);
  });
});
