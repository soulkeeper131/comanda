import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Role } from "./session";

/**
 * Текущото състояние на потребителя в базата. Бисквитката е валидна 7 дни —
 * без тази проверка деактивиран потребител или сменена роля важат чак
 * когато бисквитката изтече.
 */
export function currentUserState(uid: string): { active: boolean; role: Role } | null {
  const row = db
    .select({ active: users.active, role: users.role })
    .from(users)
    .where(eq(users.id, uid))
    .get();
  if (!row) return null;
  return { active: row.active !== false, role: row.role as Role };
}
