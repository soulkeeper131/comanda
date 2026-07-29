import { cookies } from "next/headers";

const envSecret = process.env.BETTER_AUTH_K;
const K = envSecret || "komanda-dev-secret";
const SESSION_COOKIE = "komanda_session";

export type User = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "owner" | "worker" | "inspector";
};

const USERS: (User & { password: string })[] = [
  { id: "u1", email: "admin@komanda.bg", password: "admin1234", name: "Админ", role: "admin" },
  { id: "u2", email: "owner@komanda.bg", password: "owner1234", name: "Собственик", role: "owner" },
  { id: "u3", email: "worker@komanda.bg", password: "worker1234", name: "Работник", role: "worker" },
  { id: "u4", email: "inspector@komanda.bg", password: "inspector1234", name: "Инспектор", role: "inspector" },
];

export function validateUser(email: string, password: string): User | null {
  const user = USERS.find((u) => u.email === email);
  if (!user || user.password !== password) return null;
  const { password: _, ...safe } = user;
  return safe;
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
