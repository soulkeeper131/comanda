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
  /** Съседните планирани обходи от същия абонамент — не се застъпват. */
  prevDate?: string | null;
  nextDate?: string | null;
};

/**
 * Позволеният прозорец за клиента: от утре (инспекторът трябва да разбере
 * навреме) до 14 дни след първоначалната дата, но преди следващия обход от
 * абонамента и не след края му. null = няма позволена дата.
 */
export function rescheduleWindow(c: Omit<RescheduleCheck, "to" | "status" | "isAdmin">): { min: string; max: string } | null {
  let min = addDays(c.today, 1);
  if (c.prevDate && c.prevDate >= min) min = addDays(c.prevDate, 1);
  const base = c.originalDate && c.originalDate > c.today ? c.originalDate : c.today;
  let max = addDays(base, MAX_RESCHEDULE_DAYS);
  if (c.nextDate) max = [max, addDays(c.nextDate, -1)].sort()[0];
  if (c.planEndsAt) max = [max, c.planEndsAt.slice(0, 10)].sort()[0];
  return min <= max ? { min, max } : null;
}

export function canReschedule(c: RescheduleCheck): { ok: true } | { ok: false; error: string } {
  if (c.status !== "planned") {
    return { ok: false, error: "Мести се само планиран обход — започнат или завършен не може." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.to)) return { ok: false, error: "Изберете дата." };
  if (c.to < c.today) return { ok: false, error: "Не може да се мести назад във времето." };
  if (!c.isAdmin) {
    if (c.to <= c.today) return { ok: false, error: "Най-рано за утре — инспекторът трябва да разбере навреме." };
    // Границата е от първоначалната дата — иначе обходът се отлага безкрай,
    // като се мести по 14 дни всеки път.
    const base = c.originalDate && c.originalDate > c.today ? c.originalDate : c.today;
    if (c.to > addDays(base, MAX_RESCHEDULE_DAYS)) {
      return { ok: false, error: `Обходът се мести до ${MAX_RESCHEDULE_DAYS} дни след първоначалната му дата.` };
    }
    if (c.planEndsAt && c.to > c.planEndsAt.slice(0, 10)) {
      return { ok: false, error: "Абонаментът изтича преди тази дата." };
    }
    if (c.nextDate && c.to >= c.nextDate) {
      return { ok: false, error: "Не може на или след следващия обход — преместете него." };
    }
    if (c.prevDate && c.to <= c.prevDate) {
      return { ok: false, error: "Не може на или преди предишния обход." };
    }
  }
  return { ok: true };
}
