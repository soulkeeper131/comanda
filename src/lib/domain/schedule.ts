import { isHoliday } from "./holidays";

/**
 * Генератор на дати за обходи (N7) — чиста функция, без база.
 *
 * Правилата от въпросника:
 * - честота по брой на месец: 4 → на 7 дни, 2 → на 14, 1 → на 30 (въпрос 3)
 * - админът насрочва първия обход, останалите следват от него (въпрос 7)
 * - три месеца напред (въпрос 8)
 * - официалните празници се пропускат — мести се САМО тази дата към
 *   следващия работен ден, не целия график (въпрос 9); уикендите са работни
 * - всяка дата има поредност (seq) — идемпотентността е по нея, не по датата,
 *   защото клиентът може да мести обходи (въпрос 11)
 */

export const HORIZON_MONTHS = 3;

export function intervalDays(perMonth: number): number {
  if (perMonth >= 4) return 7;
  if (perMonth === 3) return 10;
  if (perMonth === 2) return 14;
  return 30;
}

/** "YYYY-MM-DD" + n дни, без часови зони (UTC аритметика). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  // Краят на месеца се подрязва: 31 януари + 1 месец = 28/29 февруари.
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Следващият ден, който не е празник (самата дата, ако не е). */
export function nextWorkingDay(date: string): string {
  let d = date;
  // Най-дългата поредица празници е 3 дни (Коледа) — 10 е с голям запас.
  for (let i = 0; i < 10 && isHoliday(d); i++) d = addDays(d, 1);
  return d;
}

export type ScheduleInput = {
  /** Първият обход, насрочен от админа ("YYYY-MM-DD"). */
  firstDate: string;
  perMonth: number;
  /** Днешната дата — нищо не се създава назад във времето. */
  today: string;
  /** Край на абонамента при отказ (въпрос 5) — нищо след него. */
  endsAt?: string | null;
  horizonMonths?: number;
  /** Сезонен пакет — обходи само в прозореца "MM-DD"–"MM-DD". */
  season?: { from?: string | null; to?: string | null };
};

export type ScheduledVisit = { seq: number; date: string };

export function scheduleVisits(input: ScheduleInput): ScheduledVisit[] {
  const step = intervalDays(input.perMonth);
  const horizon = addMonths(input.today, input.horizonMonths ?? HORIZON_MONTHS);
  const out: ScheduledVisit[] = [];

  for (let seq = 0; seq < 1000; seq++) {
    const nominal = addDays(input.firstDate, seq * step);
    if (nominal > horizon) break;
    // Първата дата е изрично уговорена с клиента — не я местим.
    const date = seq === 0 ? nominal : nextWorkingDay(nominal);
    if (input.endsAt && date > input.endsAt.slice(0, 10)) break;
    if (date < input.today) continue;
    if (input.season && !inSeason(date, input.season.from, input.season.to)) continue;
    out.push({ seq, date });
  }
  return out;
}

/** Ключ за идемпотентност — един обход на (план, услуга, поредност). */
export function genKey(planId: string, templateId: string, seq: number): string {
  return `${planId}:${templateId}:${seq}`;
}

/**
 * Активен ли е сезонен пакет на дадена дата. Прозорецът е "MM-DD" и може да
 * минава през Нова година (напр. 10-01 → 04-30 за зимния).
 */
export function inSeason(date: string, from?: string | null, to?: string | null): boolean {
  if (!from || !to) return true;
  const md = date.slice(5, 10);
  return from <= to ? md >= from && md <= to : md >= from || md <= to;
}
