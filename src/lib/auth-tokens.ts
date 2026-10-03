import crypto from "node:crypto";
import { db } from "@/db";
import { authTokens, users } from "@/db/schema";
import { and, eq, gt, isNull } from "drizzle-orm";
import { isEmailConfigured } from "@/lib/email";
import { notify } from "@/lib/messages";

export type TokenType = "verify_email" | "reset_password";

const TTL_MS: Record<TokenType, number> = {
  verify_email: 48 * 60 * 60 * 1000,
  reset_password: 60 * 60 * 1000,
};

/** Версията на общите условия, с които потребителят се е съгласил. */
export const TERMS_VERSION = "2026-09";

const hash = (raw: string) => crypto.createHash("sha256").update(raw).digest("hex");

/** Нов еднократен токен. В базата — само хешът; суровият отива в имейла. */
export function createToken(userId: string, type: TokenType, ttlMs: number = TTL_MS[type]): string {
  const raw = crypto.randomBytes(32).toString("base64url");
  // Старите неизползвани токени от същия вид спират да важат.
  db.update(authTokens)
    .set({ used_at: new Date().toISOString() })
    .where(and(eq(authTokens.user_id, userId), eq(authTokens.type, type), isNull(authTokens.used_at)))
    .run();
  db.insert(authTokens)
    .values({
      user_id: userId,
      type,
      token_hash: hash(raw),
      expires_at: new Date(Date.now() + ttlMs).toISOString(),
    })
    .run();
  return raw;
}

/** Изразходва токена. Връща id на потребителя или null (невалиден/изтекъл/използван). */
export function consumeToken(raw: unknown, type: TokenType): string | null {
  if (typeof raw !== "string" || raw.length < 20 || raw.length > 100) return null;
  const now = new Date().toISOString();
  const row = db
    .select()
    .from(authTokens)
    .where(
      and(
        eq(authTokens.token_hash, hash(raw)),
        eq(authTokens.type, type),
        isNull(authTokens.used_at),
        gt(authTokens.expires_at, now),
      ),
    )
    .get();
  if (!row) return null;
  const res = db
    .update(authTokens)
    .set({ used_at: now })
    .where(and(eq(authTokens.id, row.id), isNull(authTokens.used_at)))
    .run();
  return res.changes === 1 ? row.user_id : null;
}

/**
 * Праща линк за потвърждение. Без настроен SMTP линкът не може да стигне
 * до никого — тогава адресът се приема за потвърден (и се логва), за да не
 * заключим регистрацията. Връща true, ако е изпратен имейл.
 */
export async function sendVerification(userId: string): Promise<boolean> {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return false;
  if (!(await isEmailConfigured())) {
    console.warn(`[auth] SMTP не е настроен — ${user.email} е потвърден без имейл.`);
    db.update(users).set({ email_verified_at: new Date().toISOString() }).where(eq(users.id, userId)).run();
    return false;
  }
  const token = createToken(userId, "verify_email");
  await notify("account_verify", {
    emailTo: user.email,
    vars: { name: user.full_name ?? "" },
    link: `/verify-email?token=${token}`,
  });
  return true;
}

export async function sendPasswordReset(userId: string): Promise<void> {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return;
  const token = createToken(userId, "reset_password");
  await notify("account_reset", { emailTo: user.email, vars: { email: user.email }, link: `/reset-password?token=${token}` });
}

const ROLE_LABEL: Record<string, string> = { admin: "администратор", inspector: "инспектор", client: "клиент" };

/**
 * Покана за профил, създаден от админ: връзка за задаване на парола (3 дни),
 * вместо временна парола, която админът да предава на ръка. Връща true,
 * ако имейлът е изпратен (без SMTP — няма как).
 */
export async function sendInvite(userId: string): Promise<boolean> {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user || !(await isEmailConfigured())) return false;
  const token = createToken(userId, "reset_password", 3 * 24 * 60 * 60 * 1000);
  await notify("account_invite", {
    emailTo: user.email,
    vars: { name: user.full_name ?? "", role: ROLE_LABEL[user.role] ?? user.role },
    link: `/reset-password?token=${token}`,
  });
  return true;
}

