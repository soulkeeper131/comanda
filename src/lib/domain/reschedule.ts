import { addDays } from "./schedule";

/** Докъде напред клиентът може да мести обход (въпрос 11). */
export const MAX_RESCHEDULE_DAYS = 14;

export type RescheduleCheck = {
  status: string;
  /** Новата дата "YYYY-MM-DD" */
  to: string;
  today: string;
  isAdmin: boolean;
  /** Първоначалната дата на обхода (преди всички премествания). */
  originalDate?: string;
  /** Край на абонамента — обход не се мести след него. */
  planEndsAt?: string | null;
};

export function canReschedule(c: RescheduleCheck): { ok: true } | { ok: false; error: string } {
  if (c.status !== "planned") {
    return { ok: false, error: "Мести се само планиран обход — започнат или завършен не може." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.to)) return { ok: false, error: "Изберете дата." };
  if (c.to < c.today) return { ok: false, error: "Не може да се мести назад във времето." };
  if (!c.isAdmin) {
    // Границата е от първоначалната дата — иначе обходът се отлага безкрай,
    // като се мести по 14 дни всеки път.
    const base = c.originalDate && c.originalDate > c.today ? c.originalDate : c.today;
    if (c.to > addDays(base, MAX_RESCHEDULE_DAYS)) {
      return { ok: false, error: `Обходът се мести до ${MAX_RESCHEDULE_DAYS} дни след първоначалната му дата.` };
    }
    if (c.planEndsAt && c.to > c.planEndsAt.slice(0, 10)) {
      return { ok: false, error: "Абонаментът изтича преди тази дата." };
    }
  }
  return { ok: true };
}
