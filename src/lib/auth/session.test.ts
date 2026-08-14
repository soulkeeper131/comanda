import { describe, it, expect, beforeEach, afterEach } from "vitest";

const VALID_SECRET = "x".repeat(32);

describe("session", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = VALID_SECRET;
  });
  afterEach(() => {
    delete process.env.SESSION_SECRET;
  });

  it("подписва и разчита обратно същите данни", async () => {
    const { signSession, verifySession } = await import("./session");
    const data = { uid: "u1", role: "client" as const, org_id: "org1" };
    const token = signSession(data);
    expect(verifySession(token)).toEqual(data);
  });

  it("отхвърля токен с подправен payload", async () => {
    const { signSession, verifySession } = await import("./session");
    const token = signSession({ uid: "u1", role: "client", org_id: "org1" });
    const [, sig] = token.split(".");
    const evil = Buffer.from(
      JSON.stringify({ uid: "u1", role: "admin", org_id: "org1", ts: Date.now() }),
    ).toString("base64url");
    expect(verifySession(`${evil}.${sig}`)).toBeNull();
  });

  it("отхвърля токен с подправен подпис", async () => {
    const { signSession, verifySession } = await import("./session");
    const token = signSession({ uid: "u1", role: "client", org_id: "org1" });
    const [payload] = token.split(".");
    expect(verifySession(`${payload}.deadbeef`)).toBeNull();
  });

  it("отхвърля безформен токен", async () => {
    const { verifySession } = await import("./session");
    expect(verifySession("глупости")).toBeNull();
    expect(verifySession("")).toBeNull();
    expect(verifySession("a.b.c")).toBeNull();
  });

  it("отхвърля изтекла сесия", async () => {
    const { verifySession } = await import("./session");
    const crypto = await import("node:crypto");
    const old = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const payload = Buffer.from(
      JSON.stringify({ uid: "u1", role: "client", org_id: "org1", ts: old }),
    ).toString("base64url");
    const sig = crypto
      .createHmac("sha256", VALID_SECRET)
      .update(payload)
      .digest("base64url");
    expect(verifySession(`${payload}.${sig}`)).toBeNull();
  });

  it("отказва да работи без секрет", async () => {
    delete process.env.SESSION_SECRET;
    const { getSessionSecret } = await import("./session");
    expect(() => getSessionSecret()).toThrow(/SESSION_SECRET/);
  });

  it("отказва да работи с къс секрет", async () => {
    process.env.SESSION_SECRET = "късо";
    const { getSessionSecret } = await import("./session");
    expect(() => getSessionSecret()).toThrow(/32/);
  });
});
