import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export type User = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "client" | "inspector";
  org_id?: string;
  phone?: string;
  company_name?: string;
  eik?: string;
  vat_number?: string;
  billing_address?: string;
};

/** След толкова поредни грешни пароли профилът се заключва за малко. */
export const LOCK_AFTER_FAILURES = 5;
const LOCK_MINUTES = 15;
// За непознат имейл също се сравнява хеш — иначе по времето за отговор
// личи кои адреси имат профил.
const DUMMY_HASH = "$2b$10$N2o1Ylxc2CxcWV/V0sBdp.SUIGehJD.4GiNSuLSsBNyS4BASpqYPC";

export type LoginResult =
  | { ok: true; user: User }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "locked"; minutes: number };

// Грешните опити за имейли без профил — в паметта, само за да отговаряме
// еднакво („заключено" след 5), иначе заключването издава кои имейли имат профил.
const ghostFailures = new Map<string, { failed: number; lockedUntil: number }>();

function ghostAttempt(email: string, now: number): LoginResult {
  const g = ghostFailures.get(email) ?? { failed: 0, lockedUntil: 0 };
  if (g.lockedUntil > now) return { ok: false, reason: "locked", minutes: Math.ceil((g.lockedUntil - now) / 60_000) };
  g.failed += 1;
  const lock = g.failed % LOCK_AFTER_FAILURES === 0;
  if (lock) g.lockedUntil = now + LOCK_MINUTES * 60_000;
  ghostFailures.set(email, g);
  if (ghostFailures.size > 10_000) ghostFailures.clear();
  return lock ? { ok: false, reason: "locked", minutes: LOCK_MINUTES } : { ok: false, reason: "invalid" };
}

/**
 * Проверка на имейл и парола. След всеки 5 поредни грешни опита профилът се
 * заключва за 15 минути (не повече — иначе всеки може да държи чужд профил
 * заключен с часове); успешен вход или нова парола нулират брояча. С 5
 * опита на 15 минути отгатването на парола е безнадеждно бавно.
 */
export async function validateUser(email: string, password: string, now = new Date()): Promise<LoginResult> {
  const row = db.select().from(users).where(eq(users.email, email)).get();
  if (!row) {
    await bcrypt.compare(password, DUMMY_HASH);
    return ghostAttempt(email, now.getTime());
  }
  const lockedFor = row.locked_until ? Date.parse(row.locked_until) - now.getTime() : 0;
  if (lockedFor > 0) return { ok: false, reason: "locked", minutes: Math.ceil(lockedFor / 60_000) };

  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) {
    const failed = (row.failed_logins ?? 0) + 1;
    const lock = failed % LOCK_AFTER_FAILURES === 0;
    db.update(users)
      .set({ failed_logins: failed, ...(lock ? { locked_until: new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString() } : {}) })
      .where(eq(users.id, row.id))
      .run();
    return lock ? { ok: false, reason: "locked", minutes: LOCK_MINUTES } : { ok: false, reason: "invalid" };
  }
  if (!row.active) return { ok: false, reason: "invalid" };
  if (row.failed_logins || row.locked_until) {
    db.update(users).set({ failed_logins: 0, locked_until: null }).where(eq(users.id, row.id)).run();
  }

  return {
    ok: true,
    user: {
    id: row.id,
    email: row.email,
    name: row.full_name ?? "",
    role: row.role as User["role"],
    org_id: row.org_id ?? undefined,
    phone: row.phone ?? undefined,
    company_name: row.company_name ?? undefined,
    eik: row.eik ?? undefined,
    vat_number: row.vat_number ?? undefined,
    billing_address: row.billing_address ?? undefined,
    },
  };
}

/** Create a new user with bcrypt-hashed password */
export async function createUser(
  email: string,
  password: string,
  name: string,
  role: User["role"] = "client",
  org_id?: string,
  extra?: { phone?: string; company_name?: string; eik?: string; vat_number?: string; billing_address?: string },
): Promise<User> {
  const hash = await bcrypt.hash(password, 10);
  const id = crypto.randomUUID();
  db.insert(users).values({
    id,
    email,
    password_hash: hash,
    full_name: name,
    role,
    org_id: org_id ?? null,
    phone: extra?.phone ?? null,
    company_name: extra?.company_name ?? null,
    eik: extra?.eik ?? null,
    vat_number: extra?.vat_number ?? null,
    billing_address: extra?.billing_address ?? null,
    active: true,
  }).run();
  return { id, email, name, role, org_id, phone: extra?.phone, company_name: extra?.company_name, eik: extra?.eik, vat_number: extra?.vat_number };
}

/** Return a single user by ID */
export function getUser(uid: string): User | null {
  const row = db.select().from(users).where(eq(users.id, uid)).get();
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.full_name ?? "",
    role: row.role as User["role"],
    org_id: row.org_id ?? undefined,
    phone: row.phone ?? undefined,
    company_name: row.company_name ?? undefined,
    eik: row.eik ?? undefined,
    vat_number: row.vat_number ?? undefined,
  };
}

/** Return all active users (limited to 100) */
export function listUsers(): User[] {
  const rows = db.select().from(users).where(eq(users.active, true)).limit(100).all();
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.full_name ?? "",
    role: row.role as User["role"],
  }));
}
