import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Истинска SQLite база във временна папка — генераторът се проверява срещу
// същата схема и миграции, които вървят в продукция.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "komanda-gen-"));
fs.cpSync(path.join(process.cwd(), "drizzle"), path.join(dir, "drizzle"), { recursive: true });
process.chdir(dir);

type Db = typeof import("@/db")["db"];
let db: Db;
let schema: typeof import("@/db/schema");
let gen: typeof import("@/lib/jobs-generator");

beforeAll(async () => {
  ({ db } = await import("@/db"));
  schema = await import("@/db/schema");
  gen = await import("@/lib/jobs-generator");

  const { organizations, users, properties, serviceTemplates, plans } = schema;
  db.insert(organizations).values({ id: "o", name: "K" }).run();
  db.insert(users).values([
    { id: "c", org_id: "o", email: "c@x.bg", password_hash: "x", role: "client" },
    { id: "i", org_id: "o", email: "i@x.bg", password_hash: "x", role: "inspector" },
  ]).run();
  db.insert(properties)
    .values({ id: "p", org_id: "o", owner_id: "c", name: "Имот", lat: 1, lng: 1, status: "active", assigned_inspector_id: "i" })
    .run();
  db.insert(serviceTemplates).values({ id: "t", org_id: "o", category: "inspection", name: "Обход" }).run();
  db.insert(plans)
    .values({ id: "pl", property_id: "p", template_id: "t", name: "Стандарт", per_month: 2, status: "active", first_job_at: "2026-12-10" })
    .run();
});

describe("генератор на обходи върху база", () => {
  it("създава обходите с инспектора на имота и прескача Бъдни вечер", () => {
    const created = gen.generateForPlan("pl", "2026-12-01");
    const jobs = db.select().from(schema.jobs).all().sort((a, b) => a.planned_at.localeCompare(b.planned_at));
    expect(created).toBe(jobs.length);
    expect(jobs[0].planned_at).toBe("2026-12-10");
    expect(jobs[1].planned_at).toBe("2026-12-27"); // 24.12 е празник
    expect(jobs.every((j) => j.assignee_id === "i")).toBe(true);
  });

  it("второ пускане не дублира, дори след преместване", async () => {
    const { eq } = await import("drizzle-orm");
    const first = db.select().from(schema.jobs).all()[0];
    db.update(schema.jobs).set({ planned_at: "2026-12-12" }).where(eq(schema.jobs.id, first.id)).run();
    const before = db.select().from(schema.jobs).all().length;
    expect(gen.generateForPlan("pl", "2026-12-01")).toBe(0);
    expect(db.select().from(schema.jobs).all().length).toBe(before);
  });

  it("отказът маха само планираните след края на периода", async () => {
    const { eq } = await import("drizzle-orm");
    const all = db.select().from(schema.jobs).all();
    // Един обход е започнат — той остава, дори да е след края.
    const late = all.find((j) => j.planned_at > "2027-01-01")!;
    db.update(schema.jobs).set({ status: "in_progress" }).where(eq(schema.jobs.id, late.id)).run();
    db.insert(schema.jobReschedules)
      .values({ job_id: all.find((j) => j.planned_at === "2026-12-27")!.id, user_id: "c", from_date: "2026-12-27", to_date: "2026-12-28" })
      .run();

    const removed = gen.removePlannedJobsAfter("pl", "2026-12-31");
    const left = db.select().from(schema.jobs).all();
    expect(removed).toBeGreaterThan(0);
    expect(left.some((j) => j.id === late.id)).toBe(true);
    expect(left.filter((j) => j.status === "planned").every((j) => j.planned_at <= "2026-12-31")).toBe(true);
  });
});
