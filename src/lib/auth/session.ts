import crypto from "node:crypto";
import { cookies } from "next/headers";

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

/** Подписва сесията и я записва в httpOnly бисквитка. */
export async function setSession(data: SessionData): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, signSession(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_MS / 1000,
  });
}

/** Изтрива сесийната бисквитка. */
export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
