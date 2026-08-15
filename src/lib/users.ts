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
};

/** Query the DB for a user by email and verify password */
export async function validateUser(email: string, password: string): Promise<User | null> {
  const row = db.select().from(users).where(eq(users.email, email)).get();
  if (!row) return null;
  if (!row.active) return null;

  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return null;

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

/** Create a new user with bcrypt-hashed password */
export async function createUser(
  email: string,
  password: string,
  name: string,
  role: User["role"] = "client",
  org_id?: string,
  extra?: { phone?: string; company_name?: string; eik?: string; vat_number?: string },
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
