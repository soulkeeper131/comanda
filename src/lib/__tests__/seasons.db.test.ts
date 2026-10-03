import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Stripe from "stripe";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "komanda-seasons-"));
fs.cpSync(path.join(process.cwd(), "drizzle"), path.join(dir, "drizzle"), { recursive: true });
// Шрифтът за фактурите, прикачени към имейлите.
fs.cpSync(path.join(process.cwd(), "assets"), path.join(dir, "assets"), { recursive: true });
process.chdir(dir);

// Stripe на ужким — записваме какво му казваме.
const stripeCalls: { kind: string; args: unknown[] }[] = [];
const fakeStripe = {
  subscriptions: {
    update: async (...args: unknown[]) => {
      stripeCalls.push({ kind: "subscriptions.update", args });
      return {};
    },
  },
  customers: { create: async () => ({ id: "cus_1" }) },
  checkout: {
    sessions: {
      create: async (...args: unknown[]) => {
        stripeCalls.push({ kind: "checkout.create", args });
        return { id: "cs_1", url: "https://stripe.test/cs_1" };
      },
    },
  },
};
vi.mock("@/lib/stripe", async (orig) => ({
  ...(await orig<typeof import("@/lib/stripe")>()),
  getStripeOrNull: () => fakeStripe,
}));

let db: typeof import("@/db")["db"];
let s: typeof import("@/db/schema");
let subs: typeof import("@/lib/subscriptions");
let periodic: typeof import("@/lib/periodic");
let gen: typeof import("@/lib/jobs-generator");
let catalog: typeof import("@/lib/catalog");
let eq: typeof import("drizzle-orm")["eq"];
let and: typeof import("drizzle-orm")["and"];

const planRow = (id: string) => db.select().from(s.plans).where(eq(s.plans.id, id)).get()!;
const plannedJobs = (planId: string) =>
  db.select().from(s.jobs).where(and(eq(s.jobs.plan_id, planId), eq(s.jobs.status, "planned"))).all();
const notes = (type?: string) =>
  db
    .select()
    .from(s.notifications)
    .all()
    .filter((n) => !type || n.title === type);

beforeAll(async () => {
  ({ db } = await import("@/db"));
  s = await import("@/db/schema");
  subs = await import("@/lib/subscriptions");
  periodic = await import("@/lib/periodic");
  gen = await import("@/lib/jobs-generator");
  catalog = await import("@/lib/catalog");
  ({ eq, and } = await import("drizzle-orm"));
  db.insert(s.organizations).values({ id: "o", name: "K" }).run();
  db.insert(s.users).values({ id: "a", org_id: "o", email: "a@x.bg", password_hash: "x", role: "admin" }).run();
  db.insert(s.users).values({ id: "c", org_id: "o", email: "c@x.bg", password_hash: "x", role: "client", full_name: "Иван" }).run();
  db.insert(s.users).values({ id: "i", org_id: "o", email: "i@x.bg", password_hash: "x", role: "inspector" }).run();
  db.insert(s.properties)
    .values({ id: "p", org_id: "o", owner_id: "c", name: "Вила", lat: 1, lng: 1, status: "active", assigned_inspector_id: "i" })
    .run();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("каталог v2", () => {
  it("обходът получава сезонни точки, а сайтът — истински услуги", () => {
    const list = catalog.loadCatalog();
    const full = list.find((p) => p.name === "Пълен надзор")!;
    const winter = list.find((p) => p.name === "Зимен сезон")!;
    const summer = list.find((p) => p.name === "Летен сезон")!;
    const labels = (pkg: typeof full) => catalog.coreItem(pkg)!.checklist.map((c) => c.label);

    expect(labels(full)).toContain("Пощенска кутия — пощата е прибрана");
    expect(labels(full)).toContain("Стени и ъгли — без влага и мухъл");
    expect(labels(full)).toContain("Климатик — пробно пускане, без теч");
    // Зимният пакет няма летни точки и обратно.
    expect(labels(winter)).toContain("Стени и ъгли — без влага и мухъл");
    expect(labels(winter)).not.toContain("Климатик — пробно пускане, без теч");
    expect(labels(summer)).toContain("Климатик — пробно пускане, без теч");
    expect(labels(summer)).not.toContain("Стени и ъгли — без влага и мухъл");
    expect(catalog.coreItem(winter)!.steps).toBeLessThan(catalog.coreItem(full)!.steps);

    const services = db.select().from(s.serviceTemplates).all().map((t) => t.name);
    for (const name of ["Проверка след буря", "Присъствие при майстор", "Поливане и грижа за двора"]) {
      expect(services).toContain(name);
    }
  });

  it("второ зареждане не дублира, изтрита точка не се връща", () => {
    const core = catalog.coreItem(catalog.loadCatalog()[0])!;
    const before = db.select().from(s.templateItems).where(eq(s.templateItems.template_id, core.template_id)).all();
    const mail = before.find((i) => i.label.startsWith("Пощенска кутия"))!;
    db.delete(s.templateItems).where(eq(s.templateItems.id, mail.id)).run();
    catalog.loadCatalog();
    catalog.upgradeCatalog();
    const after = db.select().from(s.templateItems).where(eq(s.templateItems.template_id, core.template_id)).all();
    expect(after).toHaveLength(before.length - 1);
    expect(db.select().from(s.serviceTemplates).all().filter((t) => t.name === "Проверка след буря")).toHaveLength(1);
  });
});

describe("сезонен абонамент по банка", () => {
  const winterPlan = (id: string, paidUntil: string) => {
    const tpl = catalog.coreItem(catalog.loadCatalog().find((p) => p.name === "Зимен сезон")!)!;
    db.insert(s.plans)
      .values({
        id,
        property_id: "p",
        template_id: tpl.template_id,
        name: "Зимен сезон",
        per_month: 2,
        price: 40,
        status: "active",
        first_job_at: "2026-10-01",
        paid_until: paidUntil,
        season_from: "10-01",
        season_to: "04-30",
      })
      .run();
  };

  it("извън сезона не иска превод; седмица преди сезона — иска, за месеца от 1 октомври", async () => {
    winterPlan("w1", "2027-05-09");
    expect(await subs.billBankPlans("2027-06-15")).toBe(0);
    expect(await subs.billBankPlans("2027-09-20")).toBe(0);
    expect(await subs.billBankPlans("2027-09-24")).toBe(1);
    const n = notes("Плащане за следващия месец").at(-1)!;
    expect(n.body).toContain("01.10.2027");
    // и не е „просрочен" извън сезона, макар платеното да е изтекло през май
    expect(await periodic.remindOverduePlans("2027-09-30")).toBe(0);
    db.delete(s.payments).where(eq(s.payments.plan_id, "w1")).run();
    db.delete(s.plans).where(eq(s.plans.id, "w1")).run();
  });
});

describe("неплатен превод: напомняния, спиране след 14 дни, връщане", () => {
  it("ден 1 и 7 — напомняне; ден 15 — бъдещите обходи спират; плащане — графикът се връща", async () => {
    const tpl = catalog.coreItem(catalog.loadCatalog().find((p) => p.name === "Пълен надзор")!)!;
    db.insert(s.plans)
      .values({
        id: "b1",
        property_id: "p",
        template_id: tpl.template_id,
        name: "Пълен надзор",
        per_month: 2,
        price: 60,
        status: "active",
        first_job_at: "2026-10-20",
        paid_until: "2026-11-04",
      })
      .run();
    expect(gen.generateForPlan("b1", "2026-10-20")).toBeGreaterThan(0);

    expect(await subs.billBankPlans("2026-10-28")).toBe(1);
    expect(await periodic.remindOverduePlans("2026-11-04")).toBe(0);
    expect(await periodic.remindOverduePlans("2026-11-05")).toBe(1);
    expect(await periodic.remindOverduePlans("2026-11-06")).toBe(0);
    expect(await periodic.remindOverduePlans("2026-11-11")).toBe(1);
    expect(notes("Абонаментът не е платен").at(-1)!.body).toContain("18.11.2026");

    // До 14-ия ден включително обходите вървят.
    expect(await periodic.suspendOverduePlans("2026-11-18")).toBe(0);
    expect(await periodic.suspendOverduePlans("2026-11-19")).toBe(1);
    expect(planRow("b1").suspended_at).toBeTruthy();
    expect(plannedJobs("b1").every((j) => j.planned_at.slice(0, 10) <= "2026-11-19")).toBe(true);
    expect(notes("Обходите са спрени")).toHaveLength(1);
    expect(notes("Спрени обходи — неплатен абонамент")).toHaveLength(1);
    // Генераторът не ги връща сам; второ пускане не праща второ известие.
    expect(gen.generateForPlan("b1", "2026-11-20")).toBe(0);
    expect(await periodic.suspendOverduePlans("2026-11-21")).toBe(0);

    // Преводът пристига на 25.11 → период от днес, графикът се връща.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-25T10:00:00Z"));
    const pending = db.select().from(s.payments).where(and(eq(s.payments.plan_id, "b1"), eq(s.payments.status, "pending"))).get()!;
    const res = await subs.settlePlanPayment(pending.id);
    expect(res.ok).toBe(true);
    expect(planRow("b1").suspended_at).toBeNull();
    expect(planRow("b1").paid_until).toBe("2026-12-24");
    expect(plannedJobs("b1").some((j) => j.planned_at.slice(0, 10) > "2026-11-25")).toBe(true);
    expect(notes("Обходите продължават")).toHaveLength(1);
  });

  it("закъснял превод в гратиса продължава без дупка", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-12-28T10:00:00Z"));
    // платено до 24.12, преводът идва на 28.12 → покрива 25.12–24.01
    expect(await subs.billBankPlans("2026-12-20")).toBe(1);
    const pending = db.select().from(s.payments).where(and(eq(s.payments.plan_id, "b1"), eq(s.payments.status, "pending"))).get()!;
    expect((await subs.settlePlanPayment(pending.id)).ok).toBe(true);
    expect(planRow("b1").paid_until).toBe("2027-01-24");
  });
});

describe("сезонен абонамент с карта", () => {
  it("заявка преди сезона — картата се таксува от първия ден на сезона", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-09-10T10:00:00Z"));
    const tpl = catalog.coreItem(catalog.loadCatalog().find((p) => p.name === "Зимен сезон")!)!;
    db.insert(s.properties).values({ id: "p2", org_id: "o", owner_id: "c", name: "Къща", lat: 1, lng: 1, status: "active" }).run();
    db.insert(s.plans)
      .values({
        id: "k1",
        property_id: "p2",
        template_id: tpl.template_id,
        name: "Зимен сезон",
        per_month: 2,
        price: 40,
        status: "pending_payment",
        season_from: "10-01",
        season_to: "04-30",
      })
      .run();
    await subs.createSubscriptionCheckout("k1", "c");
    const created = stripeCalls.find((c) => c.kind === "checkout.create")!;
    const params = created.args[0] as { subscription_data: { trial_end?: number } };
    // 1 октомври 00:00 българско време = 30 септември 21:00 UTC
    expect(params.subscription_data.trial_end).toBe(Date.parse("2027-09-30T21:00:00Z") / 1000);

    // Нулевата фактура при запазването на картата — без плащане и фактура.
    await subs.onSubscriptionCheckoutCompleted({
      mode: "subscription",
      subscription: "sub_k1",
      client_reference_id: "k1",
      metadata: { plan_id: "k1" },
    } as unknown as Stripe.Checkout.Session);
    const zero = {
      id: "in_zero",
      amount_paid: 0,
      amount_due: 0,
      period_end: Date.parse("2027-09-30T21:00:00Z") / 1000,
      parent: { subscription_details: { subscription: "sub_k1" } },
      lines: { data: [{ period: { end: Date.parse("2027-09-30T21:00:00Z") / 1000 } }] },
    } as unknown as Stripe.Invoice;
    await subs.onInvoicePaid(zero);
    expect(db.select().from(s.payments).where(eq(s.payments.plan_id, "k1")).all()).toHaveLength(0);
    expect(planRow("k1").billing_paused_until).toBe("2027-09-30");
  });

  it("теглене, чийто следващ месец е извън сезона → пауза до следващия сезон", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2028-04-10T10:00:00Z"));
    stripeCalls.length = 0;
    const end = Date.parse("2028-05-10T00:00:00Z") / 1000;
    await subs.onInvoicePaid({
      id: "in_apr",
      amount_paid: 4000,
      amount_due: 4000,
      period_end: end,
      parent: { subscription_details: { subscription: "sub_k1" } },
      lines: { data: [{ period: { end } }] },
    } as unknown as Stripe.Invoice);
    expect(planRow("k1").paid_until).toBe("2028-05-10");
    expect(planRow("k1").billing_paused_until).toBe("2028-10-01");
    const update = stripeCalls.find((c) => c.kind === "subscriptions.update")!;
    expect(update.args[0]).toBe("sub_k1");
    expect(update.args[1]).toEqual({
      pause_collection: { behavior: "void", resumes_at: Date.parse("2028-09-30T21:00:00Z") / 1000 },
    });

    // Периодичната задача не я слага втори път; след сезона паузата се чисти.
    expect(await subs.syncSeasonPauses("2028-04-20")).toBe(0);
    expect(await subs.syncSeasonPauses("2028-10-01")).toBe(0);
    expect(planRow("k1").billing_paused_until).toBeNull();
  });
});
