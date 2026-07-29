import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const envSecret = process.env.BETTER_AUTH_K;
const K = envSecret || "komanda-dev-secret";
const SESSION_COOKIE = "komanda_session";

export type User = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "owner" | "worker" | "inspector";
};

/** Query the DB for a user by email and verify password */
export async function validateUser(email: string, password: string): Promise<User | null> {
  const row = db.select().from(users).where(eq(users.email, email)).get();
  if (!row) return null;
  if (!row.active) return null;

  const ok = await bcrypt.compare(password, row.password_hash);
  if (ok) {
    return {
      id: row.id,
      email: row.email,
      name: row.full_name ?? "",
      role: row.role as User["role"],
    };
  }

  // Fallback: DB may have plaintext passwords from old seed. Auto-migrate to bcrypt.
  if (row.password_hash === password) {
    const newHash = await bcrypt.hash(password, 10);
    db.update(users).set({ password_hash: newHash }).where(eq(users.id, row.id)).run();
    return {
      id: row.id,
      email: row.email,
      name: row.full_name ?? "",
      role: row.role as User["role"],
    };
  }

  return null;
}

/** Create a new user with bcrypt-hashed password */
export async function createUser(
  email: string,
  password: string,
  name: string,
  role: User["role"] = "worker",
  org_id?: string,
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
    active: true,
  }).run();
  return { id, email, name, role };
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

function sign(data: string): string {
  let h = 0;
  const k = data + K;
  for (let i = 0; i < k.length; i++) h = ((h << 5) - h + k.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

export async function setSession(user: User) {
  const payload = JSON.stringify({ uid: user.id, role: user.role, ts: Date.now() });
  const encoded = Buffer.from(payload).toString("base64");
  (await cookies()).set(SESSION_COOKIE, encoded + "." + sign(encoded), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSession(): Promise<{ uid: string; role: string } | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64").toString());
    if (Date.now() - payload.ts > 7 * 24 * 60 * 60 * 1000) return null;
    if (parts[1] !== sign(parts[0])) return null;
    return { uid: payload.uid, role: payload.role };
  } catch {
    return null;
  }
}
