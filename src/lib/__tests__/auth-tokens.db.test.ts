import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "komanda-tok-"));
fs.cpSync(path.join(process.cwd(), "drizzle"), path.join(dir, "drizzle"), { recursive: true });
process.chdir(dir);

let tokens: typeof import("@/lib/auth-tokens");
let db: typeof import("@/db")["db"];
let schema: typeof import("@/db/schema");

beforeAll(async () => {
  ({ db } = await import("@/db"));
  schema = await import("@/db/schema");
  tokens = await import("@/lib/auth-tokens");
  db.insert(schema.organizations).values({ id: "o", name: "K" }).run();
  db.insert(schema.users).values({ id: "u", org_id: "o", email: "u@x.bg", password_hash: "x", role: "client" }).run();
});

describe("еднократни токени", () => {
  it("важи веднъж", () => {
    const raw = tokens.createToken("u", "reset_password");
    expect(tokens.consumeToken(raw, "reset_password")).toBe("u");
    expect(tokens.consumeToken(raw, "reset_password")).toBe(null);
  });

  it("видът трябва да съвпада", () => {
    const raw = tokens.createToken("u", "verify_email");
    expect(tokens.consumeToken(raw, "reset_password")).toBe(null);
    expect(tokens.consumeToken(raw, "verify_email")).toBe("u");
  });

  it("нов линк спира стария", () => {
    const old = tokens.createToken("u", "reset_password");
    const fresh = tokens.createToken("u", "reset_password");
    expect(tokens.consumeToken(old, "reset_password")).toBe(null);
    expect(tokens.consumeToken(fresh, "reset_password")).toBe("u");
  });

  it("изтекъл не важи", async () => {
    const { eq } = await import("drizzle-orm");
    const raw = tokens.createToken("u", "reset_password");
    db.update(schema.authTokens).set({ expires_at: "2000-01-01T00:00:00.000Z" }).where(eq(schema.authTokens.user_id, "u")).run();
    expect(tokens.consumeToken(raw, "reset_password")).toBe(null);
  });

  it("без SMTP адресът се приема за потвърден", async () => {
    const { eq } = await import("drizzle-orm");
    expect(await tokens.sendVerification("u")).toBe(false);
    expect(db.select().from(schema.users).where(eq(schema.users.id, "u")).get()?.email_verified_at).toBeTruthy();
  });
});
