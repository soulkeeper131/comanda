import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import type { Role } from "./session";

/**
 * Текущото състояние на потребителя в базата. Бисквитката е валидна 7 дни —
 * без тази проверка деактивиран потребител или сменена роля важат чак
 * когато бисквитката изтече.
 */
export function currentUserState(uid: string): { active: boolean; role: Role; sessionVersion: number } | null {
  const row = db
    .select({ active: users.active, role: users.role, sv: users.session_version })
    .from(users)
    .where(eq(users.id, uid))
    .get();
  if (!row) return null;
  return { active: row.active !== false, role: row.role as Role, sessionVersion: row.sv ?? 0 };
}

/**
 * Сесия за потребителя с текущата му версия — за входа, потвърждението на
 * имейла и новата парола.
 */
export function sessionFor(user: { id: string; role: string; org_id?: string | null }, fallbackOrg: string): {
  uid: string;
  role: Role;
  org_id: string;
  sv: number;
} {
  const row = db.select({ sv: users.session_version }).from(users).where(eq(users.id, user.id)).get();
  return { uid: user.id, role: user.role as Role, org_id: user.org_id ?? fallbackOrg, sv: row?.sv ?? 0 };
}

/**
 * Всички сесии на потребителя спират да важат (смяна на паролата, „изход от
 * всички устройства"). Връща новата версия — за бисквитката на текущото устройство.
 */
export function revokeSessions(uid: string): number {
  const [row] = db
    .update(users)
    .set({ session_version: sql`${users.session_version} + 1` })
    .where(eq(users.id, uid))
    .returning({ sv: users.session_version })
    .all();
  return row?.sv ?? 0;
}
