# Ко Манда Production Readiness — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Да направим Ко Манда безопасна за пускане на публичен домейн, с процеси които изпълняват обещанието на продукта, разбита на поддържаеми модули и с довършен дизайн за клиент и инспектор.

**Architecture:** Централизиран auth слой (`lib/auth/`), който прави проверката невъзможна за забравяне; бизнес правилата се изнасят в `lib/domain/` отделно от HTTP, за да са тестваеми и преизползваеми; схемата има един източник на истина (Drizzle) с одитна следа за админските прескачания.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Drizzle ORM + better-sqlite3, Tailwind CSS, Framer Motion, Vitest (нов), Stripe, nodemailer, web-push.

**Спецификация:** `docs/superpowers/specs/2026-08-14-production-readiness-design.md`

## Global Constraints

- **Език на UI и съобщенията за грешка:** български. Кодът, коментарите на нови модули и commit съобщенията също са на български, следвайки съществуващата практика в repo-то.
- **Бранд цветове:** bg `#e8f1f2`, primary `#1b98e0`, secondary `#247ba0`, dark `#006494`, accent `#a663cc`.
- **Mobile-first:** 16px минимален размер на input (иначе iOS зумва), 44px минимални touch targets, safe-area insets.
- **Всички API routes:** `export const dynamic = "force-dynamic"`.
- **Няма реални данни в БД** — миграциите не пазят обратна съвместимост.
- **Снимките** отиват на локалния файлов диск (`data/photos/`), не в облак.
- **Никакъв тих admin bypass** — всяко прескачане на проверка се записва в `overrides` с автор, време и причина.
- **`SESSION_SECRET`** е задължителен, минимум 32 знака, без fallback стойност в кода.

---

## Файлова структура

**Нови модули:**

| Файл | Отговорност |
|---|---|
| `src/lib/auth/session.ts` | HMAC подписване/четене на сесия. Единственото място, което знае формата ѝ. |
| `src/lib/auth/policy.ts` | Правата като данни — кой какво може. |
| `src/lib/auth/guard.ts` | `withAuth` обвивка за route handlers. |
| `src/lib/auth/index.ts` | Публичен вход към auth слоя. |
| `src/lib/domain/jobs.ts` | Правила за задачи: старт, отмятане, завършване, геофенсинг. |
| `src/lib/domain/offers.ts` | Правила за оферти: разрешени преходи. |
| `src/lib/domain/overrides.ts` | Записване на админските прескачания. |
| `src/lib/geo.ts` | Разстояние между координати (haversine). |
| `scripts/seed.ts` | CLI seed (заменя `/api/seed`). |
| `scripts/reset-db.ts` | CLI reset (заменя `/api/reset-passwords`). |

**Съществуващи, които се променят съществено:**

| Файл | Промяна |
|---|---|
| `src/lib/auth.ts` | Разбива се на `lib/auth/*`; остава re-export за плавен преход, маха се в Task 19. |
| `src/db/index.ts` | Свива се до отваряне на връзка; ръчният `CREATE TABLE` и `migrate()` отпадат. |
| `src/db/schema.ts` | Добавя `overrides`, индекси, координати на check-in, връзка item→снимка. |
| `src/middleware.ts` | Rate limiting и session guard стават независими. |
| `next.config.mjs` | Махат се `ignoreBuildErrors` и `ignoreDuringBuilds`. |
| `tsconfig.json` | Добавя се `target: "es2017"`. |

---

## Фаза 1 — Сигурност (Задачи 1–9)

### Task 1: Тестова инфраструктура

Без runner нищо по-нататък не е доказуемо. Vitest, защото стартира без конфигурация при Next.js и е бърз.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: `npm test` (еднократно), `npm run test:watch`. Всички следващи задачи разчитат на тях.

- [ ] **Step 1: Инсталирай Vitest**

```bash
npm install -D vitest@^2 @vitest/ui
```

- [ ] **Step 2: Създай `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 3: Добави скриптове в `package.json`**

В секция `"scripts"` добави:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Напиши smoke тест**

Файл `src/lib/__tests__/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("тестовата инфраструктура", () => {
  it("работи", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Пусни тестовете**

Run: `npm test`
Expected: PASS — 1 тест минава.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/__tests__/smoke.test.ts
git commit -m "test: Vitest инфраструктура"
```

---

### Task 2: HMAC подписване на сесията

Заменя 32-битовия djb2 хеш, който се брутфорсва офлайн за секунди.

**Files:**
- Create: `src/lib/auth/session.ts`
- Create: `src/lib/auth/session.test.ts`

**Interfaces:**
- Produces:
  - `type SessionData = { uid: string; role: "admin" | "client" | "inspector"; org_id: string }`
  - `signSession(data: SessionData): string`
  - `verifySession(token: string): SessionData | null`
  - `getSessionSecret(): string` — хвърля, ако секретът липсва или е под 32 знака
  - Константа `SESSION_COOKIE = "komanda_session"`

- [ ] **Step 1: Напиши тестовете**

Файл `src/lib/auth/session.test.ts`:

```ts
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
```

- [ ] **Step 2: Пусни тестовете — трябва да се провалят**

Run: `npm test -- session`
Expected: FAIL — "Cannot find module './session'".

- [ ] **Step 3: Напиши `src/lib/auth/session.ts`**

```ts
import crypto from "node:crypto";

export const SESSION_COOKIE = "komanda_session";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type Role = "admin" | "client" | "inspector";

export type SessionData = {
  uid: string;
  role: Role;
  org_id: string;
};

type Payload = SessionData & { ts: number };

/** Връща секрета или хвърля. Няма fallback — това е нарочно. */
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET липсва. Приложението не може да стартира без него.",
    );
  }
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET трябва да е поне 32 знака.");
  }
  return secret;
}

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
}

export function signSession(data: SessionData): string {
  const payload: Payload = { ...data, ts: Date.now() };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifySession(token: string): SessionData | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encoded, provided] = parts;
  const expected = sign(encoded);

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString(),
    ) as Payload;
    if (typeof payload.ts !== "number") return null;
    if (Date.now() - payload.ts > MAX_AGE_MS) return null;
    if (!payload.uid || !payload.role) return null;
    return { uid: payload.uid, role: payload.role, org_id: payload.org_id };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Пусни тестовете**

Run: `npm test -- session`
Expected: PASS — 7 теста.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/session.ts src/lib/auth/session.test.ts
git commit -m "feat: HMAC-SHA256 подписване на сесията"
```

---

### Task 3: Политики за достъп

**Files:**
- Create: `src/lib/auth/policy.ts`
- Create: `src/lib/auth/policy.test.ts`

**Interfaces:**
- Consumes: `Role`, `SessionData` от Task 2.
- Produces:
  - `canViewProperty(session, property: { owner_id: string }): boolean`
  - `canDecideOffer(session, property: { owner_id: string }): boolean`
  - `canCompleteJobItem(session, job: { assignee_id: string | null }): boolean`
  - `canOverride(session): boolean`
  - `isAdmin(session): boolean`

- [ ] **Step 1: Напиши тестовете**

Файл `src/lib/auth/policy.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  canViewProperty,
  canDecideOffer,
  canCompleteJobItem,
  canOverride,
  isAdmin,
} from "./policy";
import type { SessionData } from "./session";

const admin: SessionData = { uid: "a1", role: "admin", org_id: "org1" };
const owner: SessionData = { uid: "c1", role: "client", org_id: "org1" };
const other: SessionData = { uid: "c2", role: "client", org_id: "org1" };
const inspector: SessionData = { uid: "i1", role: "inspector", org_id: "org1" };

describe("canViewProperty", () => {
  const property = { owner_id: "c1" };

  it("позволява на собственика", () => {
    expect(canViewProperty(owner, property)).toBe(true);
  });
  it("позволява на админ", () => {
    expect(canViewProperty(admin, property)).toBe(true);
  });
  it("позволява на инспектор", () => {
    expect(canViewProperty(inspector, property)).toBe(true);
  });
  it("отказва на друг клиент", () => {
    expect(canViewProperty(other, property)).toBe(false);
  });
});

describe("canDecideOffer", () => {
  const property = { owner_id: "c1" };

  it("позволява на собственика — той плаща", () => {
    expect(canDecideOffer(owner, property)).toBe(true);
  });
  it("отказва на админ — не решава от името на клиента", () => {
    expect(canDecideOffer(admin, property)).toBe(false);
  });
  it("отказва на инспектор", () => {
    expect(canDecideOffer(inspector, property)).toBe(false);
  });
  it("отказва на друг клиент", () => {
    expect(canDecideOffer(other, property)).toBe(false);
  });
});

describe("canCompleteJobItem", () => {
  it("позволява на назначения инспектор", () => {
    expect(canCompleteJobItem(inspector, { assignee_id: "i1" })).toBe(true);
  });
  it("отказва на неназначен инспектор", () => {
    expect(canCompleteJobItem({ ...inspector, uid: "i9" }, { assignee_id: "i1" })).toBe(false);
  });
  it("позволява на админ", () => {
    expect(canCompleteJobItem(admin, { assignee_id: "i1" })).toBe(true);
  });
  it("отказва на клиент", () => {
    expect(canCompleteJobItem(owner, { assignee_id: "i1" })).toBe(false);
  });
});

describe("canOverride", () => {
  it("само админ прескача проверки", () => {
    expect(canOverride(admin)).toBe(true);
    expect(canOverride(inspector)).toBe(false);
    expect(canOverride(owner)).toBe(false);
  });
});

describe("isAdmin", () => {
  it("различава админ от останалите", () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(owner)).toBe(false);
  });
});
```

- [ ] **Step 2: Пусни тестовете — трябва да се провалят**

Run: `npm test -- policy`
Expected: FAIL — "Cannot find module './policy'".

- [ ] **Step 3: Напиши `src/lib/auth/policy.ts`**

```ts
import type { SessionData } from "./session";

/**
 * Правата на едно място, като функции без странични ефекти.
 * Всяка отговаря на въпроса „има ли право?", без да знае за HTTP.
 */

export function isAdmin(session: SessionData): boolean {
  return session.role === "admin";
}

/** Имот се вижда от собственика, от админ и от инспектор (обхожда го). */
export function canViewProperty(
  session: SessionData,
  property: { owner_id: string },
): boolean {
  if (session.role === "admin" || session.role === "inspector") return true;
  return property.owner_id === session.uid;
}

/**
 * Оферта се приема/отказва само от собственика на имота — той плаща.
 * Админът нарочно НЕ може да реши вместо него.
 */
export function canDecideOffer(
  session: SessionData,
  property: { owner_id: string },
): boolean {
  return session.role === "client" && property.owner_id === session.uid;
}

/** Стъпка се отмята от назначения инспектор или от админ. */
export function canCompleteJobItem(
  session: SessionData,
  job: { assignee_id: string | null },
): boolean {
  if (session.role === "admin") return true;
  if (session.role !== "inspector") return false;
  return job.assignee_id === session.uid;
}

/** Само админ прескача проверки (снимка, геофенсинг) — и то с причина. */
export function canOverride(session: SessionData): boolean {
  return session.role === "admin";
}
```

- [ ] **Step 4: Пусни тестовете**

Run: `npm test -- policy`
Expected: PASS — 16 теста.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/policy.ts src/lib/auth/policy.test.ts
git commit -m "feat: политики за достъп като чисти функции"
```

---

### Task 4: `withAuth` guard

**Files:**
- Create: `src/lib/auth/guard.ts`
- Create: `src/lib/auth/guard.test.ts`
- Create: `src/lib/auth/index.ts`

**Interfaces:**
- Consumes: `SESSION_COOKIE`, `verifySession`, `SessionData`, `Role` от Task 2.
- Produces:
  - `withAuth(opts, handler)` където `opts: { role?: Role[] }`
  - Handler-ът получава `(request: Request, ctx: { session: SessionData; params: Record<string, string> })`
  - `type AuthedContext = { session: SessionData; params: Record<string, string> }`

- [ ] **Step 1: Напиши тестовете**

Файл `src/lib/auth/guard.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const VALID_SECRET = "x".repeat(32);
let cookieValue: string | undefined;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieValue ? { name, value: cookieValue } : undefined,
  }),
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
});
```

- [ ] **Step 2: Пусни тестовете — трябва да се провалят**

Run: `npm test -- guard`
Expected: FAIL — "Cannot find module './guard'".

- [ ] **Step 3: Напиши `src/lib/auth/guard.ts`**

```ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "./session";
import type { Role, SessionData } from "./session";

export type AuthedContext = {
  session: SessionData;
  params: Record<string, string>;
};

type RouteContext = { params?: Record<string, string> };

type Handler = (
  request: Request,
  ctx: AuthedContext,
) => Promise<Response> | Response;

export type AuthOptions = {
  /** Ако е зададено, сесията трябва да е с една от тези роли. */
  role?: Role[];
};

/**
 * Обвивка за route handler.
 *
 * Route без withAuth не получава `session` — значи не може да работи с
 * потребителски данни. Забравянето става счупен код, а не тиха дупка.
 */
export function withAuth(options: AuthOptions, handler: Handler) {
  return async function (
    request: Request,
    ctx: RouteContext = {},
  ): Promise<Response> {
    const raw = (await cookies()).get(SESSION_COOKIE)?.value;
    const session = raw ? verifySession(raw) : null;

    if (!session) {
      return NextResponse.json({ error: "Не сте влезли" }, { status: 401 });
    }

    if (options.role && !options.role.includes(session.role)) {
      return NextResponse.json(
        { error: "Нямате права за това действие" },
        { status: 403 },
      );
    }

    try {
      return await handler(request, { session, params: ctx.params ?? {} });
    } catch (error) {
      console.error("[withAuth] Необработена грешка:", error);
      return NextResponse.json({ error: "Възникна грешка" }, { status: 500 });
    }
  };
}
```

- [ ] **Step 4: Напиши `src/lib/auth/index.ts`**

```ts
export { SESSION_COOKIE, signSession, verifySession, getSessionSecret } from "./session";
export type { Role, SessionData } from "./session";
export { withAuth } from "./guard";
export type { AuthedContext, AuthOptions } from "./guard";
export * from "./policy";
```

- [ ] **Step 5: Пусни тестовете**

Run: `npm test -- guard`
Expected: PASS — 7 теста.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/guard.ts src/lib/auth/guard.test.ts src/lib/auth/index.ts
git commit -m "feat: withAuth guard за route handlers"
```

---

### Task 5: Изнасяне на destructive endpoints като CLI

`/api/reset-passwords` в момента трие `properties`, `users` и `organizations` без никаква автентикация. Това е най-опасното нещо в repo-то.

**Files:**
- Delete: `src/app/api/reset-passwords/route.ts`
- Delete: `src/app/api/seed/route.ts`
- Delete: `src/app/api/migrate/route.ts`
- Create: `scripts/seed.ts`
- Create: `scripts/reset-db.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `npm run db:seed`, `npm run db:reset`.

- [ ] **Step 1: Прочети какво прави сегашният seed**

Run: `cat src/app/api/seed/route.ts`

Запази логиката за създаване на организация, тримата потребители (admin/client/inspector), шаблоните и петте примерни имота. Тя се пренася, не се измисля наново.

- [ ] **Step 2: Създай `scripts/seed.ts`**

Пренеси логиката от route-а. Скриптът трябва:
- да чете паролите от `process.env.SEED_ADMIN_PASSWORD` и т.н., с генерирана случайна парола по подразбиране, която се отпечатва в конзолата
- да не изтрива нищо (само вмъква, ако липсва)
- да завършва с `process.exit(0)`

```ts
import { db } from "../src/db";
import { organizations, users } from "../src/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

function passwordFor(envKey: string): { value: string; generated: boolean } {
  const fromEnv = process.env[envKey];
  if (fromEnv) return { value: fromEnv, generated: false };
  return { value: crypto.randomBytes(12).toString("base64url"), generated: true };
}

async function main() {
  const existing = db.select().from(organizations).where(eq(organizations.id, "org1")).get();
  if (!existing) {
    db.insert(organizations).values({ id: "org1", name: "КОМАНДА", slug: "komanda" }).run();
    console.log("✓ Организация създадена");
  }

  const seedUsers = [
    { id: "u1", email: "admin@komanda.bg", role: "admin" as const, name: "Админ", env: "SEED_ADMIN_PASSWORD" },
    { id: "u2", email: "client@komanda.bg", role: "client" as const, name: "Клиент", env: "SEED_CLIENT_PASSWORD" },
    { id: "u4", email: "inspector@komanda.bg", role: "inspector" as const, name: "Инспектор", env: "SEED_INSPECTOR_PASSWORD" },
  ];

  for (const u of seedUsers) {
    const found = db.select().from(users).where(eq(users.email, u.email)).get();
    if (found) {
      console.log(`· ${u.email} вече съществува, пропускам`);
      continue;
    }
    const { value, generated } = passwordFor(u.env);
    db.insert(users).values({
      id: u.id,
      org_id: "org1",
      email: u.email,
      password_hash: await bcrypt.hash(value, 10),
      role: u.role,
      full_name: u.name,
      active: true,
    }).run();
    console.log(`✓ ${u.email}${generated ? ` — парола: ${value}` : ""}`);
  }

  console.log("\nГотово.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Seed се провали:", e);
  process.exit(1);
});
```

- [ ] **Step 3: Създай `scripts/reset-db.ts`**

```ts
import { db } from "../src/db";
import { sql } from "drizzle-orm";
import readline from "node:readline/promises";

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_RESET !== "yes") {
    console.error("Отказвам да изтрия продукционна база. Задай ALLOW_PROD_RESET=yes, ако наистина искаш.");
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('Това изтрива ВСИЧКИ данни. Напиши "да", за да продължиш: ');
  rl.close();

  if (answer.trim().toLowerCase() !== "да") {
    console.log("Отказано.");
    process.exit(0);
  }

  db.run(sql`PRAGMA foreign_keys = OFF`);
  for (const table of [
    "overrides", "invoices", "payments", "push_subscriptions", "notifications",
    "inquiries", "offers", "finding_photos", "findings", "evidence",
    "job_items", "jobs", "plans", "template_items", "service_templates",
    "zones", "properties", "users", "organizations",
  ]) {
    db.run(sql.raw(`DELETE FROM ${table}`));
  }
  db.run(sql`PRAGMA foreign_keys = ON`);

  console.log("Базата е изчистена. Пусни `npm run db:seed`.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 4: Изтрий трите route-а**

```bash
git rm src/app/api/reset-passwords/route.ts src/app/api/seed/route.ts src/app/api/migrate/route.ts
```

- [ ] **Step 5: Добави скриптове в `package.json`**

```json
"db:seed": "npx tsx scripts/seed.ts",
"db:reset": "npx tsx scripts/reset-db.ts",
"db:generate": "npx drizzle-kit generate",
"db:migrate": "npx drizzle-kit migrate"
```

- [ ] **Step 6: Провери, че нищо не сочи към изтритите routes**

Run: `grep -rn "api/seed\|api/migrate\|api/reset-passwords" src/ --include=*.ts --include=*.tsx`
Expected: няма резултати. Ако има — оправи ги, преди да продължиш.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: destructive endpoints стават CLI скриптове"
```

---

### Task 6: Поправка на middleware

Сегашният първи `if` хваща всички `/api/` и връща рано — session guard-ът отдолу е недостижим.

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Прочети текущия файл**

Run: `cat src/middleware.ts`

Забележи: редове 9–18 хващат `/api/`, правят rate limit и `return`. Проверката за сесия на ред 36 никога не се стига за API.

- [ ] **Step 2: Пренапиши `src/middleware.ts`**

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";

/** Пътища, достъпни без сесия. */
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/inquiries",
  "/api/stripe/webhook",
  "/api/push/vapid-public-key",
];

const STATIC_PATTERN =
  /\.(html|css|js|png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|eot|pdf|json|xml|txt|map)$/i;

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/register/")) return true;
  if (pathname === "/manifest.json" || pathname === "/sw.js") return true;
  return STATIC_PATTERN.test(pathname);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Rate limiting — независимо от auth, не прекъсва потока
  let rateLimitRemaining: number | null = null;
  if (pathname.startsWith("/api/") || pathname === "/login") {
    const rl = checkRateLimit(request, pathname);
    if (!rl.allowed) return rateLimitedResponse(rl.reset);
    rateLimitRemaining = rl.remaining;
  }

  // 2. Публичните пътища минават нататък
  if (isPublic(pathname)) {
    const response = NextResponse.next();
    if (rateLimitRemaining !== null) {
      response.headers.set("X-RateLimit-Remaining", String(rateLimitRemaining));
    }
    return response;
  }

  // 3. Страници без сесия → към login.
  //    API routes се пазят от withAuth, не тук — middleware не може да
  //    провери HMAC подписа (Edge runtime няма node:crypto).
  if (!pathname.startsWith("/api/")) {
    const session = request.cookies.get("komanda_session");
    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  const response = NextResponse.next();
  if (rateLimitRemaining !== null) {
    response.headers.set("X-RateLimit-Remaining", String(rateLimitRemaining));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 3: Провери ръчно**

```bash
npm run dev
```

Провери: `/` се отваря без login; `/dashboard` без сесия пренасочва към `/login`; `curl http://localhost:3000/api/me` връща 401.

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts
git commit -m "fix: middleware — rate limiting и session guard стават независими"
```

---

### Task 7: Тест за покритие на routes

Този тест пази и след края на цикъла — новодобавен route не може тихо да остане отворен.

**Files:**
- Create: `src/app/api/__tests__/route-coverage.test.ts`

**Interfaces:**
- Consumes: нищо от предишни задачи — чете файловата система.
- Produces: провал при route без `withAuth` или `// @public`.

- [ ] **Step 1: Напиши теста**

Файл `src/app/api/__tests__/route-coverage.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const API_DIR = path.join(process.cwd(), "src", "app", "api");

function findRoutes(dir: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue;
      found.push(...findRoutes(full));
    } else if (entry.name === "route.ts") {
      found.push(full);
    }
  }
  return found;
}

describe("покритие на API routes", () => {
  const routes = findRoutes(API_DIR);

  it("намира route файлове", () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it.each(routes.map((r) => [path.relative(API_DIR, r), r]))(
    "%s използва withAuth или е изрично публичен",
    (_label, file) => {
      const source = fs.readFileSync(file, "utf8");
      const guarded = source.includes("withAuth");
      const publicMarked = source.includes("// @public");

      expect(
        guarded || publicMarked,
        `${path.relative(process.cwd(), file)} няма withAuth. ` +
          `Ако е нарочно публичен, добави коментар "// @public" с обяснение защо.`,
      ).toBe(true);
    },
  );

  it("публичните routes обясняват защо са публични", () => {
    const badlyMarked: string[] = [];
    for (const file of routes) {
      const source = fs.readFileSync(file, "utf8");
      const marker = source.match(/\/\/ @public(.*)/);
      if (marker && marker[1].trim().length < 10) {
        badlyMarked.push(path.relative(API_DIR, file));
      }
    }
    expect(badlyMarked, `Тези @public маркери нямат обяснение: ${badlyMarked.join(", ")}`).toEqual([]);
  });
});
```

- [ ] **Step 2: Пусни теста — очаквай масов провал**

Run: `npm test -- route-coverage`
Expected: FAIL — ~50 провала. Това е нарочно: тестът документира дълга, който Task 8 изплаща.

- [ ] **Step 3: Commit (тестът остава червен)**

```bash
git add src/app/api/__tests__/route-coverage.test.ts
git commit -m "test: route coverage guard (червен до Task 8)"
```

---

### Task 8: Прилагане на `withAuth` на всички routes

Най-обемната задача в плана. 53 файла. Работи се на групи, с commit след всяка — така при проблем се връщаш само една група назад.

**Files:** всички `src/app/api/**/route.ts`

**Interfaces:**
- Consumes: `withAuth` (Task 4), политиките (Task 3).

**Публични routes** (получават `// @public` с обяснение):
`auth/login`, `auth/register`, `auth/logout`, `inquiries` (POST от landing формата), `stripe/webhook` (Stripe се自 подписва), `push/vapid-public-key` (публичен ключ по дефиниция), `photos/[id]` (виж бележката в Step 6).

- [ ] **Step 1: Група 1 — админски routes**

Файлове: `admin/smtp`, `admin/smtp/test`, `admin/backup`, `email/send`, `email/test`, `push/send`, `users`, `users/[id]`.

Всеки получава `withAuth({ role: ["admin"] }, ...)`. Пример за `admin/smtp/route.ts`:

```ts
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = withAuth({ role: ["admin"] }, async () => {
  // тялото остава каквото е било
});
```

За `users/route.ts` — важно: сегашният PATCH позволява на всеки да си вдигне ролята. След обвиването с `role: ["admin"]` това се затваря.

Run: `npm test -- route-coverage` — броят провали трябва да падне с 8.

```bash
git add src/app/api/admin src/app/api/email src/app/api/push/send src/app/api/users
git commit -m "feat: withAuth на админските routes"
```

- [ ] **Step 2: Група 2 — имоти и зони**

Файлове: `properties`, `properties/[id]`, `properties/[id]/plans`, `properties/[id]/score`, `zones`, `zones/[id]`.

`withAuth({}, ...)` + проверка със `canViewProperty` за конкретния имот. Пример:

```ts
import { withAuth, canViewProperty } from "@/lib/auth";
import { NextResponse } from "next/server";

export const GET = withAuth({}, async (_req, { session, params }) => {
  const property = db.select().from(properties).where(eq(properties.id, params.id)).get();
  if (!property) {
    return NextResponse.json({ error: "Имотът не е намерен" }, { status: 404 });
  }
  if (!canViewProperty(session, property)) {
    return NextResponse.json({ error: "Нямате достъп до този имот" }, { status: 403 });
  }
  // ...
});
```

```bash
git add src/app/api/properties src/app/api/zones
git commit -m "feat: withAuth на имоти и зони"
```

- [ ] **Step 3: Група 3 — задачи**

Файлове: `jobs`, `jobs/bulk`, `jobs/[id]`, `jobs/[id]/start`, `jobs/[id]/complete`, `job-items/[id]`.

Създаване и bulk → `role: ["admin"]`. Старт/завършване/отмятане → `role: ["admin", "inspector"]`. GET → `withAuth({})`, като клиентите виждат само задачи по своите имоти (филтърът се добавя тук).

```bash
git add src/app/api/jobs src/app/api/job-items
git commit -m "feat: withAuth на задачите"
```

- [ ] **Step 4: Група 4 — констатации, оферти, доказателства**

Файлове: `findings`, `findings/[id]`, `finding-photos`, `evidence`, `offers`, `offers/[id]`, `templates`, `template-items`, `template-items/[id]`.

Шаблоните → `role: ["admin"]`. Констатации → `admin` и `inspector` създават, клиентът вижда своите. Оферти → създаване от `admin`; решението остава за Task 13.

```bash
git add src/app/api/findings src/app/api/finding-photos src/app/api/evidence src/app/api/offers src/app/api/templates src/app/api/template-items
git commit -m "feat: withAuth на констатации, оферти и шаблони"
```

- [ ] **Step 5: Група 5 — плащания, фактури, отчети, останали**

Файлове: `payments`, `payments/[id]`, `payments/confirm`, `invoices`, `invoices/[id]/pdf`, `reports/job/[id]`, `reports/property/[id]`, `stats`, `me`, `me/plans`, `notifications`, `push/subscribe`, `upload`, `geocode`, `stripe/checkout`.

`upload` получава `withAuth({})` — това затваря анонимното качване.

```bash
git add src/app/api
git commit -m "feat: withAuth на плащания, отчети и останалите routes"
```

- [ ] **Step 6: Маркирай публичните**

Всеки от тях получава коментар с обяснение. Пример за `stripe/webhook/route.ts`:

```ts
// @public Stripe вика този endpoint отвън; защитен е с подпис в тялото (constructEvent), не със сесия.
```

За `photos/[id]/route.ts`:

```ts
// @public Снимките се сервират по случайно UUID име. Познаването на URL-а е достъпът.
```

**Бележка за преценка:** това е слаба защита — всеки с линка вижда снимката. За снимки от чужд имот това е изтичане на данни. Ако решиш, че снимките трябва да са зад права, кажи и се прави отделна задача (проверка на собственост по `evidence.job_id → jobs.property_id`). Оставям го публично засега, защото затварянето изисква промяна и на клиентската част.

- [ ] **Step 7: Тестът за покритие става зелен**

Run: `npm test -- route-coverage`
Expected: PASS — всички routes са покрити.

```bash
git add -A
git commit -m "feat: всички routes са зад withAuth или изрично публични"
```

---

### Task 9: Пренасочване на login/logout към новия auth

**Files:**
- Modify: `src/app/api/auth/login/route.ts`
- Modify: `src/app/api/auth/logout/route.ts`
- Modify: `src/lib/auth.ts`
- Create: `src/lib/auth/users.ts`

**Interfaces:**
- Produces: `validateUser`, `createUser`, `getUser`, `listUsers` се преместват в `lib/auth/users.ts`; `setSession`/`clearSession` използват новия HMAC.

- [ ] **Step 1: Премести потребителските функции**

Създай `src/lib/auth/users.ts` с `validateUser`, `createUser`, `getUser`, `listUsers` от стария `src/lib/auth.ts`.

**Важно:** махни fallback-а за plaintext парола (редове 42–56 в стария файл). Той приема нехеширана парола от базата — остатък от стар seed. Няма реални данни, значи няма какво да мигрира.

- [ ] **Step 2: Добави `setSession`/`clearSession` в `session.ts`**

```ts
import { cookies } from "next/headers";

export async function setSession(data: SessionData): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, signSession(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_MS / 1000,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
```

- [ ] **Step 3: Обнови login route-а**

Сесията вече носи `org_id`. Вземи го от потребителя:

```ts
await setSession({ uid: user.id, role: user.role, org_id: user.org_id ?? "org1" });
```

Махни и `console.log` с имейла на ред 20 и 25 — не логвай кой се опитва да влезе.

- [ ] **Step 4: Изтрий стария `src/lib/auth.ts`**

Провери, че нищо не го внася:

Run: `grep -rn "from \"@/lib/auth\"" src/ | grep -v "lib/auth/"`

Всички трябва да сочат към `@/lib/auth` (папката), който резолвва към `index.ts`.

- [ ] **Step 5: Пусни всички тестове**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Ръчна проверка**

```bash
npm run dev
```

Влез с админ, провери че `/api/me` връща данни. Излез, провери че връща 401.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: login/logout минават през новия auth слой"
```

---

### Task 9б: Rate limiting, който преживява рестарт

Сегашният е in-memory `Map` — нулира се при всеки рестарт и не работи при повече от една инстанция. За login на публичен домейн това е слаба защита.

**Files:**
- Modify: `src/lib/rate-limit.ts`
- Create: `src/lib/rate-limit.test.ts`

**Interfaces:**
- Запазва сегашния публичен интерфейс: `checkRateLimit(request, pathname)` и `rateLimitedResponse(resetMs)`. Само реализацията се сменя, за да не се пипат извикванията в middleware-а.

- [ ] **Step 1: Напиши тестовете**

Файл `src/lib/rate-limit.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, __resetForTests } from "./rate-limit";

function req(ip: string): Request {
  return new Request("http://localhost/api/x", {
    headers: { "x-forwarded-for": ip },
  });
}

describe("checkRateLimit", () => {
  beforeEach(() => __resetForTests());

  it("пуска първата заявка", () => {
    expect(checkRateLimit(req("1.1.1.1"), "/api/x").allowed).toBe(true);
  });

  it("брои надолу остатъка", () => {
    const a = checkRateLimit(req("1.1.1.2"), "/api/x");
    const b = checkRateLimit(req("1.1.1.2"), "/api/x");
    expect(b.remaining).toBe(a.remaining - 1);
  });

  it("блокира след превишаване на лимита за login", () => {
    const ip = "1.1.1.3";
    for (let i = 0; i < 10; i++) checkRateLimit(req(ip), "/api/auth/login");
    expect(checkRateLimit(req(ip), "/api/auth/login").allowed).toBe(false);
  });

  it("разделя лимитите по IP", () => {
    for (let i = 0; i < 10; i++) checkRateLimit(req("1.1.1.4"), "/api/auth/login");
    expect(checkRateLimit(req("1.1.1.5"), "/api/auth/login").allowed).toBe(true);
  });

  it("разделя лимитите по път", () => {
    for (let i = 0; i < 10; i++) checkRateLimit(req("1.1.1.6"), "/api/auth/login");
    expect(checkRateLimit(req("1.1.1.6"), "/api/properties").allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Пусни — провал заради липсващия `__resetForTests`**

Run: `npm test -- rate-limit`

- [ ] **Step 3: Добави `__resetForTests` в `src/lib/rate-limit.ts`**

```ts
/** Само за тестове — изчиства броячите между случаите. */
export function __resetForTests(): void {
  windows.clear();
}
```

- [ ] **Step 4: Понижи лимита за login**

В `getLimit` — от 10 на 5 за минута. Login е най-атакуваният път.

- [ ] **Step 5: Пусни тестовете**

Run: `npm test -- rate-limit`
Expected: PASS — 5 теста. Ако тестът за login очаква 10, обнови го на 5.

- [ ] **Step 6: Commit**

```bash
git add src/lib/rate-limit.ts src/lib/rate-limit.test.ts
git commit -m "test: покритие на rate limiting + по-строг лимит за login"
```

> **Бележка:** in-memory реализацията остава. SQLite-базиран rate limit има смисъл само при повече от една инстанция; Coolify деплойът е една. Ако това се промени, задачата е малка и изолирана — интерфейсът вече е стабилен.

---

## Фаза 2 — Схема и коректност (Задачи 10–12)

### Task 10: Чиста схема с одитна следа

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/index.ts`
- Delete: `drizzle/0000_curved_barracuda.sql`, `drizzle/meta/`

- [ ] **Step 1: Добави `overrides` в `schema.ts`**

```ts
export const overrides = sqliteTable("overrides", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  admin_id: text("admin_id").references(() => users.id).notNull(),
  entity_type: text("entity_type").notNull(), // "job_item" | "job_checkin"
  entity_id: text("entity_id").notNull(),
  reason: text("reason").notNull(),
  created_at: text("created_at").default(sql`(datetime('now'))`),
});
```

- [ ] **Step 2: Добави полета за доказателство и локация**

В `jobItems`:
```ts
  evidence_id: text("evidence_id").references(() => evidence.id),
```

В `jobs`:
```ts
  check_in_lat: real("check_in_lat"),
  check_in_lng: real("check_in_lng"),
```

- [ ] **Step 3: Добави индекси**

```ts
import { index } from "drizzle-orm/sqlite-core";
```

Добави трети аргумент на съответните таблици, напр.:

```ts
export const jobs = sqliteTable("jobs", { /* ... */ }, (t) => ({
  propertyIdx: index("jobs_property_idx").on(t.property_id),
  assigneeIdx: index("jobs_assignee_idx").on(t.assignee_id),
  statusIdx: index("jobs_status_idx").on(t.status),
}));
```

Аналогично: `job_items.job_id`, `findings.property_id`, `evidence.job_id`, `offers.finding_id`, `notifications.user_id`.

- [ ] **Step 4: Изчисти `src/db/index.ts`**

Махни целия `sqlite.exec(...)` блок (редове 15–147) и всички `migrate(...)` извиквания (149–164). Остава:

```ts
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const dbDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const sqlite = new Database(path.join(dbDir, "sqlite.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
```

- [ ] **Step 5: Генерирай нова миграция**

```bash
rm -rf drizzle/ data/sqlite.db
npm run db:generate
npm run db:migrate
```

- [ ] **Step 6: Провери, че seed работи**

Run: `npm run db:seed`
Expected: създава организация и трима потребители, отпечатва паролите.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: чиста схема с overrides, индекси и координати на check-in"
```

---

### Task 11: Включване на TypeScript

**Files:**
- Modify: `next.config.mjs`, `tsconfig.json`
- Modify: файловете с грешки

- [ ] **Step 1: Добави `target` в `tsconfig.json`**

Добави в `compilerOptions`:
```json
"target": "es2017",
```

Това оправя `downlevelIteration` грешките в `ChecklistSheet.tsx:203` и `HistoryList.tsx:53`.

- [ ] **Step 2: Виж пълния списък грешки**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Поправи PDF репортите**

В `reports/job/[id]/route.ts:72` и `reports/property/[id]/route.ts:126` — `Buffer` не се приема като `BodyInit`:

```ts
return new NextResponse(new Uint8Array(pdfBuffer), {
  headers: { "Content-Type": "application/pdf" },
});
```

Същото в `photos/[id]/route.ts:46` и `invoices/[id]/pdf/route.ts`.

- [ ] **Step 4: Поправи Drizzle query builder грешките**

В `jobs/route.ts:59`, `offers/route.ts:21`, `evidence/route.ts:37` и `findings/route.ts:45` — `query = query.where(...)` не се типизира. Събери условията предварително:

```ts
const conditions = [];
if (assigneeIdFilter) conditions.push(eq(jobs.assignee_id, assigneeIdFilter));
if (statusFilter) conditions.push(eq(jobs.status, statusFilter));

const rows = db
  .select({ /* ... */ })
  .from(jobs)
  .leftJoin(properties, eq(jobs.property_id, properties.id))
  .leftJoin(users, eq(jobs.assignee_id, users.id))
  .where(conditions.length ? and(...conditions) : undefined)
  .orderBy(desc(jobs.created_at))
  .all();
```

- [ ] **Step 5: Поправи Stripe apiVersion**

В `lib/stripe.ts:16` — сложи версията, която SDK-то очаква (`"2026-07-29.dahlia"`), или махни полето, за да ползва по подразбиране.

- [ ] **Step 6: Поправи PushBell**

`PushBell.tsx:57` — сравнение с невъзможна стойност. `PushBell.tsx:82` — `Uint8Array` към `applicationServerKey`:

```ts
applicationServerKey: new Uint8Array(decoded) as BufferSource,
```

- [ ] **Step 7: Изключи флаговете**

`next.config.mjs`:

```js
const nextConfig = {
  output: "standalone",
};
```

- [ ] **Step 8: Билдни**

Run: `npx tsc --noEmit && npm run build`
Expected: и двете минават чисто.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "fix: включен TypeScript на билда + 17 поправени грешки"
```

---

### Task 12: N+1 заявки

**Files:**
- Modify: `src/app/api/properties/route.ts`, `src/app/api/jobs/route.ts`

- [ ] **Step 1: Поправи `/api/properties`**

Сегашният код прави до 3 заявки на имот в цикъл. Замени с групови заявки преди цикъла:

```ts
const activeJobs = db.select({ property_id: jobs.property_id })
  .from(jobs).where(eq(jobs.status, "in_progress")).all();
const activeSet = new Set(activeJobs.map((j) => j.property_id));

const openFindings = db.select({ property_id: findings.property_id })
  .from(findings).where(eq(findings.status, "open")).all();
const warningSet = new Set(openFindings.map((f) => f.property_id));

const overdue = db.select({ property_id: jobs.property_id })
  .from(jobs).where(and(eq(jobs.status, "planned"), lt(jobs.planned_at, now))).all();
const overdueSet = new Set(overdue.map((j) => j.property_id));

const withStatus = result.map((p) => ({
  ...p,
  status: activeSet.has(p.id) ? "in_progress"
    : warningSet.has(p.id) ? "warning"
    : overdueSet.has(p.id) ? "overdue"
    : "ok",
}));
```

- [ ] **Step 2: Поправи `/api/jobs`**

Сегашният код тегли **всички** `job_items` и **цялото** `evidence`. Замени с агрегация:

```ts
import { sql } from "drizzle-orm";

const counts = db
  .select({
    job_id: jobItems.job_id,
    total: sql<number>`count(*)`,
    checked: sql<number>`sum(case when ${jobItems.done} then 1 else 0 end)`,
  })
  .from(jobItems)
  .groupBy(jobItems.job_id)
  .all();

const photoCounts = db
  .select({ job_id: evidence.job_id, count: sql<number>`count(*)` })
  .from(evidence)
  .groupBy(evidence.job_id)
  .all();
```

- [ ] **Step 3: Провери ръчно**

```bash
npm run dev
```

Отвори dashboard, провери че имотите показват правилен статус и задачите — правилен брой стъпки.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "perf: махнати N+1 заявки в properties и jobs"
```

---

## Фаза 3 — Процесна логика (Задачи 13–16)

### Task 13: Преходи на офертата

**Files:**
- Create: `src/lib/domain/offers.ts`, `src/lib/domain/offers.test.ts`
- Modify: `src/app/api/offers/[id]/route.ts`

**Interfaces:**
- Produces:
  - `type OfferDecision = "pending" | "accepted" | "declined" | "paid" | "in_progress" | "done"`
  - `canTransition(from: OfferDecision, to: OfferDecision): boolean`
  - `allowedTransitions(from: OfferDecision): OfferDecision[]`

- [ ] **Step 1: Напиши тестовете**

Файл `src/lib/domain/offers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { canTransition, allowedTransitions } from "./offers";

describe("преходи на офертата", () => {
  it("позволява приемане и отказ от pending", () => {
    expect(canTransition("pending", "accepted")).toBe(true);
    expect(canTransition("pending", "declined")).toBe(true);
  });

  it("не позволява прескачане от pending директно към paid", () => {
    expect(canTransition("pending", "paid")).toBe(false);
    expect(canTransition("pending", "in_progress")).toBe(false);
    expect(canTransition("pending", "done")).toBe(false);
  });

  it("позволява paid само след accepted", () => {
    expect(canTransition("accepted", "paid")).toBe(true);
    expect(canTransition("declined", "paid")).toBe(false);
  });

  it("следва веригата paid → in_progress → done", () => {
    expect(canTransition("paid", "in_progress")).toBe(true);
    expect(canTransition("in_progress", "done")).toBe(true);
    expect(canTransition("paid", "done")).toBe(false);
  });

  it("declined и done са крайни", () => {
    expect(allowedTransitions("declined")).toEqual([]);
    expect(allowedTransitions("done")).toEqual([]);
  });

  it("не позволява връщане назад", () => {
    expect(canTransition("accepted", "pending")).toBe(false);
    expect(canTransition("paid", "accepted")).toBe(false);
    expect(canTransition("done", "in_progress")).toBe(false);
  });

  it("не позволява преход към себе си", () => {
    expect(canTransition("pending", "pending")).toBe(false);
  });
});
```

- [ ] **Step 2: Пусни — трябва да се провали**

Run: `npm test -- offers`
Expected: FAIL — модулът липсва.

- [ ] **Step 3: Напиши `src/lib/domain/offers.ts`**

```ts
export type OfferDecision =
  | "pending" | "accepted" | "declined" | "paid" | "in_progress" | "done";

/**
 * Разрешените преходи. Всичко извън тази карта се отказва.
 *
 * pending ──→ accepted ──→ paid ──→ in_progress ──→ done
 *    └─────→ declined
 */
const TRANSITIONS: Record<OfferDecision, OfferDecision[]> = {
  pending: ["accepted", "declined"],
  accepted: ["paid"],
  declined: [],
  paid: ["in_progress"],
  in_progress: ["done"],
  done: [],
};

export function allowedTransitions(from: OfferDecision): OfferDecision[] {
  return TRANSITIONS[from] ?? [];
}

export function canTransition(from: OfferDecision, to: OfferDecision): boolean {
  return allowedTransitions(from).includes(to);
}
```

- [ ] **Step 4: Пусни тестовете**

Run: `npm test -- offers`
Expected: PASS — 7 теста.

- [ ] **Step 5: Приложи в route-а**

`src/app/api/offers/[id]/route.ts` — замени свободното приемане на статус:

```ts
import { withAuth, canDecideOffer, isAdmin } from "@/lib/auth";
import { canTransition, allowedTransitions } from "@/lib/domain/offers";

export const PATCH = withAuth({}, async (request, { session, params }) => {
  const existing = db.select().from(offers).where(eq(offers.id, params.id)).get();
  if (!existing) {
    return NextResponse.json({ error: "Офертата не е намерена" }, { status: 404 });
  }

  const body = await request.json();

  if (body.decision !== undefined) {
    const from = existing.decision as OfferDecision;
    const to = body.decision as OfferDecision;

    if (!canTransition(from, to)) {
      return NextResponse.json(
        {
          error: `Не може да се премине от "${from}" към "${to}".`,
          allowed: allowedTransitions(from),
        },
        { status: 400 },
      );
    }

    // Кой има право на този конкретен преход
    if (to === "accepted" || to === "declined") {
      const finding = db.select().from(findings).where(eq(findings.id, existing.finding_id)).get();
      const property = finding
        ? db.select().from(properties).where(eq(properties.id, finding.property_id)).get()
        : null;
      if (!property || !canDecideOffer(session, property)) {
        return NextResponse.json(
          { error: "Само собственикът на имота може да приеме или откаже оферта" },
          { status: 403 },
        );
      }
    } else if (to === "paid") {
      // paid се задава само от Stripe webhook-а, не от потребител
      return NextResponse.json(
        { error: "Статусът 'платена' се задава автоматично след плащане" },
        { status: 403 },
      );
    } else if (!isAdmin(session)) {
      return NextResponse.json(
        { error: "Само админ може да променя този статус" },
        { status: 403 },
      );
    }
  }

  // цена/срок/обхват се променят само от админ и само докато е pending
  if (body.price !== undefined || body.days !== undefined || body.scope !== undefined) {
    if (!isAdmin(session)) {
      return NextResponse.json({ error: "Само админ може да променя офертата" }, { status: 403 });
    }
    if (existing.decision !== "pending") {
      return NextResponse.json(
        { error: "Офертата може да се променя само докато е в очакване" },
        { status: 400 },
      );
    }
  }

  // ... останалото остава
});
```

- [ ] **Step 6: Пусни всички тестове и билдни**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: валидирани преходи на офертата + права по преход"
```

---

### Task 14: Геофенсинг

**Files:**
- Create: `src/lib/geo.ts`, `src/lib/geo.test.ts`
- Create: `src/lib/domain/overrides.ts`
- Modify: `src/app/api/jobs/[id]/start/route.ts`

**Interfaces:**
- Consumes: `canOverride` (Task 3), `withAuth` (Task 4), таблицата `overrides` (Task 10).
- Produces:
  - `distanceMeters(a: Coords, b: Coords): number`, `type Coords = { lat: number; lng: number }`
  - `recordOverride(input: { admin_id: string; entity_type: "job_item" | "job_checkin"; entity_id: string; reason: string }): void`
  - `overridesFor(entity_type: string, entity_id: string)`

> **Бележка за реда:** `overrides.ts` се създава тук, защото геофенсингът е първият му потребител. Task 15 го използва наготово.

- [ ] **Step 1: Напиши тестовете за разстоянието**

Файл `src/lib/geo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { distanceMeters } from "./geo";

describe("distanceMeters", () => {
  it("връща 0 за една и съща точка", () => {
    const p = { lat: 42.6977, lng: 23.3219 };
    expect(distanceMeters(p, p)).toBe(0);
  });

  it("смята познато разстояние в София", () => {
    // НДК → Орлов мост, ~2.1 км по права линия
    const ndk = { lat: 42.6861, lng: 23.3186 };
    const orlov = { lat: 42.6923, lng: 23.3395 };
    const d = distanceMeters(ndk, orlov);
    expect(d).toBeGreaterThan(1800);
    expect(d).toBeLessThan(2400);
  });

  it("е симетрично", () => {
    const a = { lat: 42.69, lng: 23.32 };
    const b = { lat: 42.70, lng: 23.33 };
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 5);
  });

  it("хваща малки разстояния в метри", () => {
    const a = { lat: 42.690000, lng: 23.320000 };
    const b = { lat: 42.690450, lng: 23.320000 };
    expect(distanceMeters(a, b)).toBeGreaterThan(40);
    expect(distanceMeters(a, b)).toBeLessThan(60);
  });
});
```

- [ ] **Step 2: Пусни — провал**

Run: `npm test -- geo`

- [ ] **Step 3: Напиши `src/lib/geo.ts`**

```ts
export type Coords = { lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_000;

/** Разстояние по права линия между две точки (haversine), в метри. */
export function distanceMeters(a: Coords, b: Coords): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}
```

- [ ] **Step 4: Пусни тестовете**

Run: `npm test -- geo`
Expected: PASS — 4 теста.

- [ ] **Step 5: Напиши `src/lib/domain/overrides.ts`**

```ts
import { db } from "@/db";
import { overrides } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export type OverrideInput = {
  admin_id: string;
  entity_type: "job_item" | "job_checkin";
  entity_id: string;
  reason: string;
};

/** Записва прескачане на проверка. Викай ТОЧНО когато проверката е прескочена. */
export function recordOverride(input: OverrideInput): void {
  db.insert(overrides).values({
    admin_id: input.admin_id,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    reason: input.reason,
  }).run();
}

/** Прескачанията за даден обект — за показване в отчета. */
export function overridesFor(entity_type: string, entity_id: string) {
  return db.select().from(overrides)
    .where(and(eq(overrides.entity_type, entity_type), eq(overrides.entity_id, entity_id)))
    .all();
}
```

- [ ] **Step 6: Приложи в `jobs/[id]/start`**

```ts
import { withAuth, canOverride } from "@/lib/auth";
import { distanceMeters } from "@/lib/geo";
import { recordOverride } from "@/lib/domain/overrides";

export const POST = withAuth({ role: ["admin", "inspector"] }, async (request, { session, params }) => {
  const body = await request.json().catch(() => ({}));
  const { lat, lng, override_reason } = body;

  const job = db.select().from(jobs).where(eq(jobs.id, params.id)).get();
  if (!job) {
    return NextResponse.json({ error: "Задачата не е намерена" }, { status: 404 });
  }

  const property = db.select().from(properties).where(eq(properties.id, job.property_id)).get();
  if (!property) {
    return NextResponse.json({ error: "Имотът не е намерен" }, { status: 404 });
  }

  const radius = property.geofence_m ?? 75;
  const hasCoords = typeof lat === "number" && typeof lng === "number";
  const distance = hasCoords
    ? distanceMeters({ lat, lng }, { lat: property.lat, lng: property.lng })
    : null;
  const insideFence = distance !== null && distance <= radius;

  if (!insideFence) {
    // Извън периметъра (или без координати) — само админ минава, и то с причина
    if (!canOverride(session)) {
      return NextResponse.json(
        {
          error: hasCoords
            ? `Намирате се на ${Math.round(distance!)} м от имота. Трябва да сте в рамките на ${radius} м.`
            : "Локацията е недостъпна. Разрешете достъп до местоположението.",
          distance_m: distance !== null ? Math.round(distance) : null,
          geofence_m: radius,
        },
        { status: 403 },
      );
    }

    if (!override_reason || override_reason.trim().length < 5) {
      return NextResponse.json(
        { error: "За стартиране извън периметъра е задължителна причина (поне 5 знака)." },
        { status: 400 },
      );
    }

    recordOverride({
      admin_id: session.uid,
      entity_type: "job_checkin",
      entity_id: job.id,
      reason: override_reason.trim(),
    });
  }

  // ... останалата логика (копиране на items, статус in_progress)
  // при update добави координатите:
  db.update(jobs)
    .set({
      status: "in_progress",
      check_in: now,
      check_in_lat: hasCoords ? lat : null,
      check_in_lng: hasCoords ? lng : null,
    })
    .where(eq(jobs.id, params.id))
    .run();
});
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: геофенсинг при check-in с админски override"
```

---

### Task 15: Задължително доказателство

**Files:**
- Create: `src/lib/domain/jobs.ts`, `src/lib/domain/jobs.test.ts`
- Modify: `src/app/api/job-items/[id]/route.ts`, `src/app/api/jobs/[id]/complete/route.ts`

**Interfaces:**
- Consumes: `recordOverride` (Task 14), `canCompleteJobItem` и `isAdmin` (Task 3), `withAuth` (Task 4).
- Produces: `canMarkItemDone(item: ItemForCheck, opts: MarkOptions): Verdict`

- [ ] **Step 1: Напиши тестовете за правилото**

Файл `src/lib/domain/jobs.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { canMarkItemDone } from "./jobs";

describe("canMarkItemDone", () => {
  const photoItem = { proof_type: "photo", label: "Баня" };
  const noteItem = { proof_type: "note", label: "Бележка" };

  it("отказва снимкова стъпка без снимка", () => {
    const r = canMarkItemDone(photoItem, { hasEvidence: false, isAdmin: false, reason: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("снимка");
  });

  it("позволява снимкова стъпка със снимка", () => {
    expect(canMarkItemDone(photoItem, { hasEvidence: true, isAdmin: false, reason: null }).ok).toBe(true);
  });

  it("позволява стъпка без изискване за снимка", () => {
    expect(canMarkItemDone(noteItem, { hasEvidence: false, isAdmin: false, reason: null }).ok).toBe(true);
  });

  it("отказва на инспектор дори с причина — той не прескача", () => {
    const r = canMarkItemDone(photoItem, { hasEvidence: false, isAdmin: false, reason: "камерата не работи" });
    expect(r.ok).toBe(false);
  });

  it("позволява на админ с причина", () => {
    expect(
      canMarkItemDone(photoItem, { hasEvidence: false, isAdmin: true, reason: "камерата на инспектора отказа" }).ok,
    ).toBe(true);
  });

  it("отказва на админ без причина", () => {
    const r = canMarkItemDone(photoItem, { hasEvidence: false, isAdmin: true, reason: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("причина");
  });

  it("отказва на админ с твърде къса причина", () => {
    expect(canMarkItemDone(photoItem, { hasEvidence: false, isAdmin: true, reason: "ок" }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Пусни — провал**

Run: `npm test -- domain/jobs`

- [ ] **Step 3: Напиши `src/lib/domain/jobs.ts`**

```ts
export type ItemForCheck = {
  proof_type: string | null;
  label: string;
};

export type MarkOptions = {
  hasEvidence: boolean;
  isAdmin: boolean;
  reason: string | null;
};

export type Verdict = { ok: true } | { ok: false; error: string };

const MIN_REASON_LENGTH = 5;

/**
 * Може ли стъпката да се отметне като изпълнена?
 *
 * Правилото: стъпка с proof_type "photo" изисква качена снимка.
 * Админ може да прескочи, но само с причина — която се записва в overrides.
 */
export function canMarkItemDone(item: ItemForCheck, opts: MarkOptions): Verdict {
  const needsPhoto = item.proof_type === "photo";

  if (!needsPhoto || opts.hasEvidence) return { ok: true };

  if (!opts.isAdmin) {
    return {
      ok: false,
      error: `Стъпката "${item.label}" изисква снимка, преди да бъде отметната.`,
    };
  }

  if (!opts.reason || opts.reason.trim().length < MIN_REASON_LENGTH) {
    return {
      ok: false,
      error: "За отмятане без снимка е задължителна причина (поне 5 знака).",
    };
  }

  return { ok: true };
}
```

- [ ] **Step 4: Пусни тестовете**

Run: `npm test -- domain/jobs`
Expected: PASS — 7 теста.

- [ ] **Step 5: Приложи в `job-items/[id]`**

```ts
import { withAuth, canCompleteJobItem, isAdmin } from "@/lib/auth";
import { canMarkItemDone } from "@/lib/domain/jobs";
import { recordOverride } from "@/lib/domain/overrides";

export const PATCH = withAuth({ role: ["admin", "inspector"] }, async (request, { session, params }) => {
  const { done, override_reason } = await request.json();

  if (done === undefined) {
    return NextResponse.json({ error: "Полето 'done' е задължително" }, { status: 400 });
  }

  const item = db.select().from(jobItems).where(eq(jobItems.id, params.id)).get();
  if (!item) {
    return NextResponse.json({ error: "Стъпката не е намерена" }, { status: 404 });
  }

  const job = db.select().from(jobs).where(eq(jobs.id, item.job_id)).get();
  if (!job || !canCompleteJobItem(session, job)) {
    return NextResponse.json({ error: "Нямате права за тази стъпка" }, { status: 403 });
  }

  if (done) {
    const photo = db.select().from(evidence).where(eq(evidence.job_item_id, item.id)).get();
    const verdict = canMarkItemDone(item, {
      hasEvidence: Boolean(photo),
      isAdmin: isAdmin(session),
      reason: override_reason ?? null,
    });

    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.error }, { status: 400 });
    }

    // Ако е минало без снимка, значи е било прескочено — записваме
    if (!photo && item.proof_type === "photo") {
      recordOverride({
        admin_id: session.uid,
        entity_type: "job_item",
        entity_id: item.id,
        reason: override_reason.trim(),
      });
    }
  }

  db.update(jobItems).set({ done: Boolean(done) }).where(eq(jobItems.id, params.id)).run();
  const updated = db.select().from(jobItems).where(eq(jobItems.id, params.id)).get();
  return NextResponse.json(updated);
});
```

- [ ] **Step 6: Обнови `jobs/[id]/complete`**

Добави `withAuth({ role: ["admin", "inspector"] })` и провери, че всяка задължителна снимкова стъпка има доказателство (или записано прескачане). Съобщението за грешка изброява кои стъпки липсват — вече го прави за `done`, разшири го за снимките.

- [ ] **Step 7: Пусни всичко**

Run: `npm test && npm run build`

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: задължително снимково доказателство с одитиран админски override"
```

---

### Task 16: Имейли до клиента и отказ на задача

**⚠️ Тази задача изпълнява стойностите по подразбиране от §5.4 на спецификацията. Потвърди ги, преди да я започнеш.**

**Files:**
- Modify: `src/lib/email.ts`, `src/app/api/offers/route.ts`, `src/app/api/jobs/[id]/complete/route.ts`
- Create: `src/app/api/jobs/[id]/cancel/route.ts`

- [ ] **Step 1: Добави помощник за имейл до собственика**

В `src/lib/email.ts`:

```ts
/** Имейлът на собственика на имота, ако има такъв. */
export function ownerEmailFor(propertyId: string): string | null {
  const property = db.select().from(properties).where(eq(properties.id, propertyId)).get();
  if (!property) return null;
  const owner = db.select().from(users).where(eq(users.id, property.owner_id)).get();
  return owner?.email ?? null;
}
```

- [ ] **Step 2: Прати имейл до клиента при нова оферта**

В `offers/route.ts` POST — освен вътрешния имейл, прати и до собственика на имота. Вътрешният **остава**; това е добавяне на получател.

- [ ] **Step 3: Прати имейл до клиента при завършен обход**

В `jobs/[id]/complete` — същото.

- [ ] **Step 4: Създай `jobs/[id]/cancel`**

```ts
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const POST = withAuth({ role: ["admin"] }, async (request, { params }) => {
  const { reason } = await request.json().catch(() => ({}));

  if (!reason || reason.trim().length < 5) {
    return NextResponse.json({ error: "Причината е задължителна (поне 5 знака)." }, { status: 400 });
  }

  const job = db.select().from(jobs).where(eq(jobs.id, params.id)).get();
  if (!job) {
    return NextResponse.json({ error: "Задачата не е намерена" }, { status: 404 });
  }
  if (job.status === "completed") {
    return NextResponse.json({ error: "Завършена задача не може да се отмени" }, { status: 400 });
  }

  db.update(jobs)
    .set({ status: "cancelled", note: `Отменена: ${reason.trim()}` })
    .where(eq(jobs.id, params.id))
    .run();

  return NextResponse.json({ success: true });
});
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: имейли до клиента + отказ на задача"
```

---

## Фаза 4 — Модули и дизайн (Задачи 17–21)

### Task 17: Design tokens и UI примитиви

**Files:**
- Modify: `tailwind.config.ts`, `src/app/globals.css`
- Create: `src/components/ui/Button.tsx`, `Card.tsx`, `Sheet.tsx`, `Input.tsx`, `Badge.tsx`

- [ ] **Step 1: Разшири `tailwind.config.ts` с tokens**

```ts
theme: {
  extend: {
    colors: {
      brand: {
        bg: "#e8f1f2",
        primary: "#1b98e0",
        secondary: "#247ba0",
        dark: "#006494",
        accent: "#a663cc",
      },
      state: {
        ok: "#16a34a",
        warning: "#d97706",
        danger: "#dc2626",
      },
    },
    spacing: { touch: "44px" },
    borderRadius: { card: "12px", sheet: "20px" },
    fontSize: {
      "field": ["16px", "1.4"], // под 16px iOS зумва
    },
  },
},
```

- [ ] **Step 2: Създай `Button.tsx`**

```tsx
import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-primary text-white hover:bg-brand-dark",
  secondary: "bg-white text-brand-dark border border-brand-primary/30 hover:bg-brand-bg",
  ghost: "bg-transparent text-brand-secondary hover:bg-brand-bg",
  danger: "bg-state-danger text-white hover:brightness-90",
};

const SIZES: Record<Size, string> = {
  sm: "min-h-[36px] px-3 text-sm",
  md: "min-h-touch px-4 text-base",
  lg: "min-h-[52px] px-6 text-lg",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", ...props }, ref) => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 rounded-card font-medium
        transition-colors disabled:opacity-50 disabled:cursor-not-allowed
        ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  ),
);
Button.displayName = "Button";
```

- [ ] **Step 3: Създай останалите примитиви**

`Card.tsx`, `Sheet.tsx` (bottom sheet с Framer Motion и safe-area), `Input.tsx` (16px размер), `Badge.tsx` (статуси). Следвай същия шаблон — variants като карти, `forwardRef`, Tailwind класове от tokens.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: design tokens и UI примитиви"
```

---

### Task 18: Icon set вместо emoji

**Files:**
- Create: `src/components/ui/Icon.tsx`
- Modify: `src/app/dashboard/page.tsx` и компонентите с emoji

- [ ] **Step 1: Създай `Icon.tsx`**

Inline SVG набор (без външна зависимост) с иконите, които реално се ползват: `overview`, `map`, `tours`, `issues`, `properties`, `profile`, `settings`, `camera`, `check`, `warning`, `clock`, `money`.

```tsx
export type IconName =
  | "overview" | "map" | "tours" | "issues" | "properties"
  | "profile" | "settings" | "camera" | "check" | "warning" | "clock" | "money";

const PATHS: Record<IconName, string> = {
  overview: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
  check: "M20 6L9 17l-5-5",
  // ... останалите
};

export function Icon({ name, size = 20, className = "" }: {
  name: IconName; size?: number; className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round"
      strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
```

- [ ] **Step 2: Замени emoji-тата в табовете**

`ALL_TABS` в `dashboard/page.tsx` — `label` става само текст, добавя се `icon: IconName`.

- [ ] **Step 3: Провери, че не са останали emoji в UI**

Run: `grep -rn "📊\|🗺️\|📋\|⚠️\|🏠\|👤\|⚙️\|🧹\|🔧\|✅\|💰" src/components src/app --include=*.tsx`

Тези в текста на имейлите могат да останат — там са уместни.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: SVG икони вместо emoji"
```

---

### Task 19: Разбиване на dashboard монолита

1624 реда, 51 `useState`. Реже се по домейн, не по екран.

**Files:**
- Create: `src/features/{properties,jobs,findings,offers,payments}/`
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Извади данните в хукове**

За всеки домейн — хук, който капсулира зареждането и състоянието. Пример `src/features/properties/useProperties.ts`:

```ts
import { useState, useEffect, useCallback } from "react";

export type Property = {
  id: string; name: string; city: string | null; address: string | null;
  lat: number; lng: number; kind: string | null; status: string;
};

export function useProperties() {
  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/properties");
      if (!res.ok) throw new Error("Грешка при зареждане на имотите");
      setItems(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Неочаквана грешка");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return { items, loading, error, reload };
}
```

Аналогично: `useJobs`, `useFindings`, `useOffers`.

- [ ] **Step 2: Извади всеки таб като компонент**

`src/features/properties/PropertiesTab.tsx`, `jobs/ToursTab.tsx`, `findings/IssuesTab.tsx` и т.н. Всеки ползва своя хук и не знае за другите табове.

- [ ] **Step 3: Свий `dashboard/page.tsx`**

Остава: избор на таб, роля на потребителя, подредба. Целта е под 200 реда.

- [ ] **Step 4: Провери размера**

Run: `wc -l src/app/dashboard/page.tsx`
Expected: под 200.

- [ ] **Step 5: Ръчна проверка на всички табове**

```bash
npm run dev
```

Влез като админ, клиент и инспектор. Провери всеки таб.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: dashboard разбит по домейни"
```

---

### Task 20: Клиентски и инспекторски път

**Files:**
- Modify: `src/features/*`, `src/components/ChecklistSheet.tsx`

- [ ] **Step 1: Клиентски преглед**

Екранът на клиента отговаря на три въпроса без ровене: какво стана с имота ми, какво предлагате и колко струва, къде е доказателството. Снимките от последния обход излизат отпред, не заровени.

Ако има прескачания (`overrides`) по задача — показват се изрично: кой, кога, защо. Това е обещанието от §5.2.

- [ ] **Step 2: Инспекторски чеклист**

`ChecklistSheet.tsx` — едра типография, 44px+ мишени, снимка на един tap, ясно кое още липсва. Бутонът "Завърши" показва какво спира завършването.

- [ ] **Step 3: Провери на телефон**

Отвори през телефон в мрежата (или DevTools mobile). Провери, че нищо не е под 44px и нито един input не зумва при фокус.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: излъскан клиентски и инспекторски път"
```

---

### Task 21: Landing и финална проверка

**Files:**
- Modify: `src/app/page.tsx`, `src/app/api/inquiries/route.ts`
- Create: `.env.example`

- [ ] **Step 1: Приложи tokens на landing-а**

Замени ad-hoc стойностите с новите примитиви и tokens.

- [ ] **Step 2: Валидирай формата за запитване**

`inquiries` POST е публичен (`// @public`), значи е изложен. Добави: задължителни име и телефон/имейл, ограничение на дължината, по-строг rate limit.

- [ ] **Step 3: Създай `.env.example`**

```
# Задължителен, минимум 32 знака. Генерирай: openssl rand -base64 32
SESSION_SECRET=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Web Push (VAPID)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# Приложение
NEXT_PUBLIC_APP_URL=https://comanda.blv.bg
```

- [ ] **Step 4: Провери, че `.env` не е в git**

Run: `git check-ignore .env && echo "игнориран" || echo "ВНИМАНИЕ: .env се проследява"`

Ако се проследява — махни го от индекса и смени всички секрети, които са били в него.

- [ ] **Step 5: Финална проверка по списъка от §10**

Run: `npm test && npx tsc --noEmit && npm run build`

Мини през целия списък „Определение за готовност" от спецификацията.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: излъскан landing + .env.example"
```

---

## Проверка преди пускане

- [ ] `npm test` — всички минават
- [ ] `npx tsc --noEmit` — чисто
- [ ] `npm run build` — минава без `ignoreBuildErrors`
- [ ] `SESSION_SECRET` е зададен в Coolify, минимум 32 знака
- [ ] `.env` не е в git; секретите, които са били в него, са сменени
- [ ] Ръчен тест: клиент не вижда чужд имот
- [ ] Ръчен тест: клиент не може да си вдигне ролята през `/api/users`
- [ ] Ръчен тест: стъпка със снимка не се отмята без снимка
- [ ] Ръчен тест: check-in извън периметъра се отказва
- [ ] Ръчен тест: прескачането се вижда в отчета
- [ ] Backup скриптът работи срещу новата схема
