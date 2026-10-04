import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "komanda-msg-"));
fs.cpSync(path.join(process.cwd(), "drizzle"), path.join(dir, "drizzle"), { recursive: true });
process.chdir(dir);

let db: typeof import("@/db")["db"];
let s: typeof import("@/db/schema");
let m: typeof import("@/lib/messages");
let eq: typeof import("drizzle-orm")["eq"];

beforeAll(async () => {
  ({ db } = await import("@/db"));
  s = await import("@/db/schema");
  m = await import("@/lib/messages");
  ({ eq } = await import("drizzle-orm"));
  db.insert(s.organizations).values({ id: "o", name: "K" }).run();
  db.insert(s.users).values([
    { id: "c", org_id: "o", email: "c@x.bg", password_hash: "x", role: "client" },
    { id: "a1", org_id: "o", email: "a1@x.bg", password_hash: "x", role: "admin" },
    { id: "a2", org_id: "o", email: "a2@x.bg", password_hash: "x", role: "admin" },
    { id: "a3", org_id: "o", email: "a3@x.bg", password_hash: "x", role: "admin", active: false },
  ]).run();
});

const VAR = /\{\{\s*(\w+)\s*\}\}/g;

describe("каталогът", () => {
  it("всяка {{променлива}} в текстовете е описана, а примерът я съдържа", () => {
    for (const [key, def] of Object.entries(m.MESSAGES)) {
      const used = [def.title, def.body, def.subject ?? "", def.cta?.label ?? ""].flatMap((t) => Array.from(t.matchAll(VAR), (x) => x[1]));
      for (const v of used) {
        expect(Object.keys(def.vars), `${key}: {{${v}}}`).toContain(v);
        expect(Object.keys(def.sample), `${key}: пример за {{${v}}}`).toContain(v);
      }
    }
  });

  it("прегледът на всеки имейл е без неразрешени {{…}} и без emoji", () => {
    for (const key of Object.keys(m.MESSAGES) as (keyof typeof m.MESSAGES)[]) {
      const def = m.MESSAGES[key];
      const r = m.renderMessage(key, def.sample, { rows: def.sampleRows });
      expect(r.html, key).not.toMatch(/\{\{/);
      expect(r.subject, key).not.toMatch(/\{\{/);
      expect(r.subject + r.html, key).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

describe("render и промени от админа", () => {
  it("липсваща стойност изчезва, а не остава като {{име}}", () => {
    expect(m.render("{{a}} — {{b}}.", { a: "Имот" })).toBe("Имот —.");
    expect(m.render("Здравейте, {{name}}!", { name: "" })).toBe("Здравейте,!");
  });

  it("дата в края на изречението — без двойна точка", () => {
    expect(m.render("Платено до {{d}}.", { d: "03.11.2026 г." })).toBe("Платено до 03.11.2026 г.");
    expect(m.render("До {{d}}, после спира.", { d: "03.11.2026 г." })).toBe("До 03.11.2026 г., после спира.");
  });

  it("промененият текст се ползва; празното поле връща подразбиращия се", () => {
    m.saveOverride("property_approved", { title: "Готово: {{property}}", email: false });
    const e = m.effective("property_approved");
    expect(e.title).toBe("Готово: {{property}}");
    expect(e.channels.email).toBe(false);
    expect(e.customized).toBe(true);
    m.saveOverride("property_approved", null);
    expect(m.effective("property_approved").title).toBe(m.MESSAGES.property_approved.title);
  });

  it("потребителски текст в имейла се екранира", () => {
    const r = m.renderMessage("finding_new", { title: "<script>x</script>", property: "Имот" });
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("&lt;script&gt;");
  });
});

describe("notify", () => {
  it("до клиента — в приложението, с връзка към имота", async () => {
    await m.notify("property_approved", { to: "c", vars: { property: "Лозенец" }, link: m.propertyLink("p1") });
    const n = db.select().from(s.notifications).where(eq(s.notifications.user_id, "c")).all();
    expect(n).toHaveLength(1);
    expect(n[0].title).toBe("Имотът е одобрен");
    expect(n[0].body).toContain("Лозенец");
    expect(n[0].link).toBe("/dashboard?property=p1");
  });

  it("до екипа — до всички активни админи, без неактивните", async () => {
    await m.notify("property_new", { to: "admins", vars: { property: "Лозенец", address: "ул. 1", client: "Иван" } });
    const ids = db.select().from(s.notifications).where(eq(s.notifications.type, "property_pending")).all().map((n) => n.user_id).sort();
    expect(ids).toEqual(["a1", "a2"]);
  });

  it("изключен канал не се праща", async () => {
    m.saveOverride("visit_started", { app: false });
    await m.notify("visit_started", { to: "c", vars: { property: "Лозенец" } });
    expect(db.select().from(s.notifications).where(eq(s.notifications.type, "job_started")).all()).toHaveLength(0);
  });
});
