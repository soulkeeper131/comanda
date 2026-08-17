import { db } from "@/db";
import { overrides } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export type OverrideInput = {
  admin_id: string;
  entity_type: "job_item" | "job_checkin";
  entity_id: string;
  reason: string;
};

/**
 * Валидира и подготвя причината за прескачане. Чиста функция, отделена от
 * записа в базата, за да е тествана без реална SQLite връзка.
 *
 * Причината е задължителна и не може да е празна. SQLite `NOT NULL` пропуска
 * празен низ (""), а прескачане без обосновка обезсмисля обещанието към
 * клиента, че всяко заобикаляне се вижда в отчета. Затова проверката е тук —
 * важи за всеки бъдещ извикващ, не само за днешния route.
 */
export const MIN_REASON_LENGTH = 5;

/** Валидна ли е причината, без да хвърля. За проверка преди действието. */
export function isValidOverrideReason(reason: string | null | undefined): boolean {
  return (reason?.trim().length ?? 0) >= MIN_REASON_LENGTH;
}

export function normalizeOverrideReason(reason: string | null | undefined): string {
  const trimmed = reason?.trim() ?? "";
  if (trimmed.length < MIN_REASON_LENGTH) {
    throw new Error(
      `Причината за прескачане е задължителна (поне ${MIN_REASON_LENGTH} знака).`,
    );
  }
  return trimmed;
}

/** Записва прескачане на проверка. Викай ТОЧНО когато проверката е прескочена. */
export function recordOverride(input: OverrideInput): void {
  const reason = normalizeOverrideReason(input.reason);

  db.insert(overrides).values({
    admin_id: input.admin_id,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    reason,
  }).run();
}

/** Прескачанията за даден обект — за показване в отчета. */
export function overridesFor(entity_type: string, entity_id: string) {
  return db.select().from(overrides)
    .where(and(eq(overrides.entity_type, entity_type as "job_item" | "job_checkin"), eq(overrides.entity_id, entity_id)))
    .all();
}
