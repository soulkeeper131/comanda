import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const VALID_SECRET = "x".repeat(32);
let cookieValue: string | undefined;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieValue ? { name, value: cookieValue } : undefined,
  }),
}));

// Базата е заменена с таблица: a1 е админ, останалите — клиенти.
const dbUsers: Record<string, { active: boolean; role: string }> = {};
vi.mock("./user-state", () => ({
  currentUserState: (uid: string) =>
    dbUsers[uid] ?? { active: true, role: uid === "a1" ? "admin" : "client" },
}));

describe("withAuth", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = VALID_SECRET;
    cookieValue = undefined;
  });
  afterEach(() => {
    delete process.env.SESSION_SECRET;
  });

  it("връща 401 без сесия", async () => {
    const { withAuth } = await import("./guard");
    const handler = withAuth({}, async () => Response.json({ ok: true }));
    const res = await handler(new Request("http://localhost/api/x"), { params: {} });
    expect(res.status).toBe(401);
  });

  it("връща 401 при подправена сесия", async () => {
    const { withAuth } = await import("./guard");
    cookieValue = "боклук.боклук";
    const handler = withAuth({}, async () => Response.json({ ok: true }));
    const res = await handler(new Request("http://localhost/api/x"), { params: {} });
    expect(res.status).toBe(401);
  });

  it("пуска валидна сесия и подава session на handler-а", async () => {
    const { withAuth } = await import("./guard");
    const { signSession } = await import("./session");
    cookieValue = signSession({ uid: "u1", role: "client", org_id: "org1" });

    const handler = withAuth({}, async (_req, ctx) =>
      Response.json({ uid: ctx.session.uid }),
    );
    const res = await handler(new Request("http://localhost/api/x"), { params: {} });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ uid: "u1" });
  });

  it("връща 403 при недостатъчна роля", async () => {
    const { withAuth } = await import("./guard");
    const { signSession } = await import("./session");
    cookieValue = signSession({ uid: "u1", role: "client", org_id: "org1" });

    const handler = withAuth({ role: ["admin"] }, async () =>
      Response.json({ ok: true }),
    );
    const res = await handler(new Request("http://localhost/api/x"), { params: {} });
    expect(res.status).toBe(403);
  });

  it("пуска при съвпадаща роля", async () => {
    const { withAuth } = await import("./guard");
    const { signSession } = await import("./session");
    cookieValue = signSession({ uid: "a1", role: "admin", org_id: "org1" });

    const handler = withAuth({ role: ["admin"] }, async () =>
      Response.json({ ok: true }),
    );
    const res = await handler(new Request("http://localhost/api/x"), { params: {} });
    expect(res.status).toBe(200);
  });

  it("подава params на handler-а", async () => {
    const { withAuth } = await import("./guard");
    const { signSession } = await import("./session");
    cookieValue = signSession({ uid: "u1", role: "client", org_id: "org1" });

    const handler = withAuth({}, async (_req, ctx) =>
      Response.json({ id: ctx.params.id }),
    );
    const res = await handler(new Request("http://localhost/api/x"), {
      params: { id: "42" },
    });
    expect(await res.json()).toEqual({ id: "42" });
  });

  it("превръща хвърлена грешка в 500, без да изтича детайли", async () => {
    const { withAuth } = await import("./guard");
    const { signSession } = await import("./session");
    cookieValue = signSession({ uid: "u1", role: "client", org_id: "org1" });

    const handler = withAuth({}, async () => {
      throw new Error("вътрешна тайна");
    });
    const res = await handler(new Request("http://localhost/api/x"), { params: {} });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("тайна");
  });

  it("връща 401 за деактивиран потребител с валидна бисквитка", async () => {
    const { withAuth } = await import("./guard");
    const { signSession } = await import("./session");
    dbUsers["gone"] = { active: false, role: "client" };
    cookieValue = signSession({ uid: "gone", role: "client", org_id: "org1" });
    const handler = withAuth({}, async () => Response.json({ ok: true }));
    const res = await handler(new Request("http://localhost/api/x"), { params: {} });
    expect(res.status).toBe(401);
  });

  it("ролята идва от базата, не от бисквитката", async () => {
    const { withAuth } = await import("./guard");
    const { signSession } = await import("./session");
    dbUsers["demoted"] = { active: true, role: "client" };
    cookieValue = signSession({ uid: "demoted", role: "admin", org_id: "org1" });
    const handler = withAuth({ role: ["admin"] }, async () => Response.json({ ok: true }));
    const res = await handler(new Request("http://localhost/api/x"), { params: {} });
    expect(res.status).toBe(403);
  });
});
