import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "komanda-sec-"));
fs.cpSync(path.join(process.cwd(), "drizzle"), path.join(dir, "drizzle"), { recursive: true });
process.chdir(dir);

let db: typeof import("@/db")["db"];
let s: typeof import("@/db/schema");
let access: typeof import("@/lib/auth/access");
let users: typeof import("@/lib/users");
let state: typeof import("@/lib/auth/user-state");
let uploads: typeof import("@/lib/uploads");
let eq: typeof import("drizzle-orm")["eq"];

beforeAll(async () => {
  ({ db } = await import("@/db"));
  s = await import("@/db/schema");
  access = await import("@/lib/auth/access");
  users = await import("@/lib/users");
  state = await import("@/lib/auth/user-state");
  uploads = await import("@/lib/uploads");
  ({ eq } = await import("drizzle-orm"));
  db.insert(s.organizations).values({ id: "o", name: "K" }).run();
  db.insert(s.users).values({ id: "c", org_id: "o", email: "c@x.bg", password_hash: "x", role: "client" }).run();
  db.insert(s.users).values({ id: "i1", org_id: "o", email: "i1@x.bg", password_hash: "x", role: "inspector" }).run();
  db.insert(s.users).values({ id: "i2", org_id: "o", email: "i2@x.bg", password_hash: "x", role: "inspector" }).run();
  for (const [id, inspector] of [["mine", "i1"], ["other", "i2"], ["job", "i2"], ["old", "i2"]] as const) {
    db.insert(s.properties)
      .values({ id, org_id: "o", owner_id: "c", name: id, lat: 1, lng: 1, status: "active", assigned_inspector_id: inspector })
      .run();
  }
  db.insert(s.jobs).values({ org_id: "o", property_id: "job", assignee_id: "i1", title: "Обход", planned_at: "2026-10-10", status: "planned" }).run();
  db.insert(s.jobs)
    .values({ org_id: "o", property_id: "old", assignee_id: "i1", title: "Обход", planned_at: "2026-01-10", status: "completed", check_out: "2026-01-10T12:00:00Z" })
    .run();
});

describe("достъп на инспектора до имотите", () => {
  it("възложените и тези с негов обход — не чуждите и не старите", () => {
    const ids = access.inspectorPropertyIds("i1", new Date("2026-10-03T10:00:00Z"));
    expect([...ids].sort()).toEqual(["job", "mine"]);
    const session = { uid: "i1", role: "inspector" as const, org_id: "o" };
    const prop = (id: string) => db.select().from(s.properties).where(eq(s.properties.id, id)).get()!;
    expect(access.canAccessProperty(session, prop("mine"))).toBe(true);
    expect(access.canAccessProperty(session, prop("job"))).toBe(true);
    expect(access.canAccessProperty(session, prop("other"))).toBe(false);
    expect(access.canAccessProperty(session, prop("old"))).toBe(false);
    // Клиентът — само своите, админът — всичко.
    expect(access.canAccessProperty({ uid: "c", role: "client", org_id: "o" }, prop("other"))).toBe(true);
    expect(access.canAccessProperty({ uid: "zz", role: "client", org_id: "o" }, prop("other"))).toBe(false);
  });
});

describe("вход: заключване след грешни пароли и отменени сесии", () => {
  it("5 грешни опита заключват, вярната парола не минава, докато трае; после всичко се нулира", async () => {
    await users.createUser("lock@x.bg", "правилна-парола", "Тест", "client", "o");
    const t0 = new Date("2026-10-03T10:00:00Z");
    for (let i = 0; i < 4; i++) expect(await users.validateUser("lock@x.bg", "грешна", t0)).toEqual({ ok: false, reason: "invalid" });
    expect(await users.validateUser("lock@x.bg", "грешна", t0)).toEqual({ ok: false, reason: "locked", minutes: 15 });
    expect((await users.validateUser("lock@x.bg", "правилна-парола", new Date(t0.getTime() + 5 * 60_000))).ok).toBe(false);
    const later = new Date(t0.getTime() + 16 * 60_000);
    expect((await users.validateUser("lock@x.bg", "правилна-парола", later)).ok).toBe(true);
    const row = db.select().from(s.users).where(eq(s.users.email, "lock@x.bg")).get()!;
    expect(row.failed_logins).toBe(0);
    expect(row.locked_until).toBeNull();
  });

  it("непознат имейл — същите отговори като истински профил (и „заключено“ след 5)", async () => {
    const t0 = new Date("2026-10-03T10:00:00Z");
    for (let i = 0; i < 4; i++) expect(await users.validateUser("nobody@x.bg", "x", t0)).toEqual({ ok: false, reason: "invalid" });
    expect(await users.validateUser("nobody@x.bg", "x", t0)).toEqual({ ok: false, reason: "locked", minutes: 15 });
    expect((await users.validateUser("nobody@x.bg", "x", new Date(t0.getTime() + 5 * 60_000))).ok).toBe(false);
  });

  it("заключването не расте — винаги 15 минути", async () => {
    await users.createUser("lock2@x.bg", "правилна-парола", "Тест", "client", "o");
    let t = new Date("2026-10-04T10:00:00Z").getTime();
    for (let round = 0; round < 3; round++) {
      let last;
      for (let i = 0; i < 5; i++) last = await users.validateUser("lock2@x.bg", "грешна", new Date(t));
      expect(last).toEqual({ ok: false, reason: "locked", minutes: 15 });
      t += 16 * 60_000;
    }
  });

  it("отменените сесии вдигат версията", () => {
    expect(state.currentUserState("c")?.sessionVersion).toBe(0);
    expect(state.revokeSessions("c")).toBe(1);
    expect(state.currentUserState("c")?.sessionVersion).toBe(1);
    expect(state.sessionFor({ id: "c", role: "client" }, "o").sv).toBe(1);
  });
});

describe("качени файлове", () => {
  it("видът се познава по байтовете, не по името", () => {
    expect(uploads.sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe(".jpg");
    expect(uploads.sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe(".png");
    expect(uploads.sniffImage(Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "latin1"))).toBe(".webp");
    expect(uploads.sniffImage(Buffer.from("GIF89a....", "latin1"))).toBe(".gif");
    expect(uploads.sniffImage(Buffer.from("<html><script>alert(1)</script>"))).toBeNull();
  });

  it("файл без запис кой го е качил не става доказателство", () => {
    fs.mkdirSync(uploads.UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(uploads.UPLOAD_DIR, "stray.jpg"), Buffer.from([0xff, 0xd8, 0xff]));
    expect(uploads.claimUpload("stray.jpg", "i1")).toBe(false);
  });

  it("запис + собственик → веднъж; незакачените след 7 дни се трият", async () => {
    const file = new File([Buffer.from([0xff, 0xd8, 0xff, 0xdb, 1, 2, 3])], "x.png", { type: "image/png" });
    const saved = await uploads.saveImageUpload(file, "i1");
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.filename.endsWith(".jpg")).toBe(true);
    expect(uploads.claimUpload(saved.filename, "i2")).toBe(false);
    expect(uploads.claimUpload(saved.filename, "i1")).toBe(true);
    expect(uploads.claimUpload(saved.filename, "i1")).toBe(false);

    const orphan = await uploads.saveImageUpload(new File([Buffer.from("GIF89a..")], "a.gif"), "i1");
    expect(orphan.ok).toBe(true);
    if (!orphan.ok) return;
    expect(await uploads.cleanupOrphanUploads(new Date(Date.now() + 2 * 24 * 3600_000))).toBe(0);
    expect(await uploads.cleanupOrphanUploads(new Date(Date.now() + 8 * 24 * 3600_000))).toBe(1);
    expect(fs.existsSync(path.join(uploads.UPLOAD_DIR, orphan.filename))).toBe(false);
    expect(fs.existsSync(path.join(uploads.UPLOAD_DIR, saved.filename))).toBe(true);
  });
});
