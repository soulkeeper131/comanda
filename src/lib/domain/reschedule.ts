import { addDays } from "./schedule";

/** Докъде напред клиентът може да мести обход (въпрос 11). */
export const MAX_RESCHEDULE_DAYS = 14;

export type RescheduleCheck = {
  status: string;
  /** Новата дата "YYYY-MM-DD" */
  to: string;
  today: string;
  isAdmin: boolean;
};

export function canReschedule(c: RescheduleCheck): { ok: true } | { ok: false; error: string } {
  if (c.status !== "planned") {
    return { ok: false, error: "Мести се само планиран обход — започнат или завършен не може." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.to)) return { ok: false, error: "Изберете дата." };
  if (c.to < c.today) return { ok: false, error: "Не може да се мести назад във времето." };
  if (!c.isAdmin && c.to > addDays(c.today, MAX_RESCHEDULE_DAYS)) {
    return { ok: false, error: `Обходът се мести до ${MAX_RESCHEDULE_DAYS} дни напред.` };
  }
  return { ok: true };
}
