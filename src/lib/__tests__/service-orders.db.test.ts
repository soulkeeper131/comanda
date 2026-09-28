import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "komanda-ord-"));
fs.cpSync(path.join(process.cwd(), "drizzle"), path.join(dir, "drizzle"), { recursive: true });
process.chdir(dir);

let db: typeof import("@/db")["db"];
let s: typeof import("@/db/schema");
let orders: typeof import("@/lib/service-orders");

beforeAll(async () => {
  ({ db } = await import("@/db"));
  s = await import("@/db/schema");
  orders = await import("@/lib/service-orders");
  db.insert(s.organizations).values({ id: "o", name: "K" }).run();
  db.insert(s.users).values([
    { id: "c", org_id: "o", email: "c@x.bg", password_hash: "x", role: "client" },
    { id: "i", org_id: "o", email: "i@x.bg", password_hash: "x", role: "inspector" },
  ]).run();
  db.insert(s.properties).values({ id: "p", org_id: "o", owner_id: "c", name: "Имот", lat: 1, lng: 1, status: "active", assigned_inspector_id: "i" }).run();
  db.insert(s.serviceTemplates).values({ id: "t", org_id: "o", category: "cleaning", name: "Прозорци", price: 40 }).run();
  db.insert(s.serviceOrders).values({ id: "so", property_id: "p", template_id: "t", requested_by: "c", requested_date: "2026-10-10", price: 40 }).run();
  db.insert(s.payments).values({ id: "pay", user_id: "c", order_id: "so", amount: 40, method: "bank", status: "pending" }).run();
});

describe("допълнителна услуга", () => {
  it("плащане → обход при инспектора + фактура", async () => {
    const res = await orders.settleServiceOrder({ orderId: "so", method: "bank" });
    expect(res.ok).toBe(true);
    const job = db.select().from(s.jobs).all()[0];
    expect(job.planned_at).toBe("2026-10-10");
    expect(job.assignee_id).toBe("i");
    expect(db.select().from(s.payments).all()[0].status).toBe("paid");
    expect(db.select().from(s.invoices).all()).toHaveLength(1);
  });

  it("повторно (напр. webhook два пъти) не дублира", async () => {
    await orders.settleServiceOrder({ orderId: "so", paymentId: "pay", method: "card" });
    expect(db.select().from(s.jobs).all()).toHaveLength(1);
    expect(db.select().from(s.invoices).all()).toHaveLength(1);
  });
});
