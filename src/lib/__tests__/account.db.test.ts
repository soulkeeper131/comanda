import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "komanda-acc-"));
fs.cpSync(path.join(process.cwd(), "drizzle"), path.join(dir, "drizzle"), { recursive: true });
process.chdir(dir);

let db: typeof import("@/db")["db"];
let s: typeof import("@/db/schema");
let account: typeof import("@/lib/account");
let eq: typeof import("drizzle-orm")["eq"];

const photo = () => path.join(dir, "data", "photos", "ev1.jpg");

beforeAll(async () => {
  ({ db } = await import("@/db"));
  s = await import("@/db/schema");
  account = await import("@/lib/account");
  ({ eq } = await import("drizzle-orm"));
  db.insert(s.organizations).values({ id: "o", name: "K" }).run();
  db.insert(s.users).values([
    { id: "c", org_id: "o", email: "c@x.bg", password_hash: "x", role: "client", full_name: "Иван", phone: "0888", company_name: "Фирма" },
    { id: "d", org_id: "o", email: "d@x.bg", password_hash: "x", role: "client", full_name: "Петя", phone: "0877" },
    { id: "a", org_id: "o", email: "a@x.bg", password_hash: "x", role: "admin" },
  ]).run();
  db.insert(s.properties).values({ id: "p", org_id: "o", owner_id: "c", name: "Лозенец", address: "ул. 1", lat: 42.6, lng: 23.3, status: "active", access_notes: "ключ при съседа" }).run();
  db.insert(s.serviceTemplates).values({ id: "t", org_id: "o", category: "inspection", name: "Обход" }).run();
  db.insert(s.plans).values({ id: "pl", property_id: "p", template_id: "t", name: "Пълен надзор", status: "active", first_job_at: "2026-01-01" }).run();
  db.insert(s.jobs).values([
    { id: "j1", org_id: "o", property_id: "p", plan_id: "pl", planned_at: "2026-01-10", status: "completed" },
    { id: "j2", org_id: "o", property_id: "p", plan_id: "pl", planned_at: "2099-01-10", status: "planned" },
  ]).run();
  fs.mkdirSync(path.dirname(photo()), { recursive: true });
  fs.writeFileSync(photo(), "jpg");
  db.insert(s.evidence).values({ id: "e1", job_id: "j1", storage_path: "ev1.jpg" }).run();
  db.insert(s.notifications).values({ user_id: "c", type: "job_done", title: "Готово" }).run();
  db.insert(s.inquiries).values({ full_name: "Иван", email: "c@x.bg" }).run();
  db.insert(s.payments).values({ id: "pay", user_id: "c", amount: 60, status: "paid", method: "card" }).run();
  db.insert(s.invoices).values({ user_id: "c", payment_id: "pay", number: "0000000001", amount: 60 }).run();
  db.insert(s.payments).values({ id: "ref", user_id: "d", amount: 10, status: "refund_needed", method: "card" }).run();
});

describe("GDPR", () => {
  it("експортът съдържа данните без парола", () => {
    const data = account.exportAccount("c")!;
    expect(data.profile.email).toBe("c@x.bg");
    expect(JSON.stringify(data)).not.toContain("password");
    expect(data.properties[0].access_notes).toBe("ключ при съседа");
    expect(data.visits.find((v) => v.id === "j1")!.photos[0].url).toBe("/api/photos/ev1.jpg");
    expect(data.invoices).toHaveLength(1);
    expect(data.inquiries).toHaveLength(1);
  });

  it("служебен профил и дължима сума спират изтриването", () => {
    expect(account.deletionBlocker("a")).toMatch(/администратор/);
    expect(account.deletionBlocker("d")).toMatch(/връщане/);
    expect(account.deletionBlocker("c")).toBeNull();
  });

  it("изтриването анонимизира, спира абонамента и пази фактурата", async () => {
    const res = await account.deleteAccount("c");
    expect(res.ok).toBe(true);
    const u = db.select().from(s.users).where(eq(s.users.id, "c")).get()!;
    expect(u.email).toBe("deleted-c@deleted.invalid");
    expect(u.phone).toBeNull();
    expect(u.active).toBe(false);
    // Има фактура → името и фирмата остават за счетоводството
    expect(u.full_name).toBe("Иван");
    expect(u.company_name).toBe("Фирма");
    const p = db.select().from(s.properties).where(eq(s.properties.id, "p")).get()!;
    expect(p.address).toBeNull();
    expect(p.access_notes).toBeNull();
    expect(p.archived).toBe(true);
    expect(db.select().from(s.plans).get()!.status).toBe("cancelled");
    expect(db.select().from(s.jobs).all().map((j) => j.id)).toEqual(["j1"]);
    expect(db.select().from(s.notifications).all()).toHaveLength(0);
    expect(db.select().from(s.inquiries).all()).toHaveLength(0);
    expect(db.select().from(s.invoices).all()).toHaveLength(1);
    expect(fs.existsSync(photo())).toBe(false);
  });
});
