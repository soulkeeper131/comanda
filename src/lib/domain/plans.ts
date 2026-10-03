import { inSeason, nextSeasonStart } from "./schedule";

export type PlanLike = { status: string | null; active?: boolean | null; ends_at?: string | null };

/**
 * „Жив" абонамент — чакащ плащане, заявен, активен, или отказан, но още в платения период.
 * Имот има най-много един жив абонамент (въпрос 6).
 */
/** Днешната дата в София — сървърът е в UTC, а денят сменя в 00:00 българско време. */
export function sofiaToday(now: Date = new Date()): string {
  return now.toLocaleDateString("sv-SE", { timeZone: "Europe/Sofia" });
}

export function isLivePlan(plan: PlanLike, today: string = sofiaToday()): boolean {
  if (plan.status === "pending_payment" || plan.status === "requested" || plan.status === "active") {
    return plan.active !== false;
  }
  if (plan.status === "cancelled") return Boolean(plan.ends_at && plan.ends_at.slice(0, 10) >= today);
  return false;
}

/**
 * Докога работи отказан абонамент (въпрос 5): до края на платения период.
 * Докато парите се събират месечно по банка — до края на текущия месец.
 */
export function endOfPaidPeriod(today: string): string {
  const [y, m] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" + n дни (UTC аритметика, без часови зони). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Сезонът на плана ("MM-DD"–"MM-DD"); без него — целогодишен. */
export type SeasonWindow = { from?: string | null; to?: string | null } | null | undefined;

/** След толкова дни без превод бъдещите обходи спират до плащането. */
export const SUSPEND_AFTER_DAYS = 14;

/** Датата, ако е в сезона на плана; иначе първият ден на следващия сезон. */
export function seasonDayOnOrAfter(date: string, season?: SeasonWindow): string {
  if (!season?.from || !season.to || inSeason(date, season.from, season.to)) return date;
  return nextSeasonStart(date, season.from);
}

/**
 * Откога обслужването не е платено: денят след платеното, а при сезонен
 * пакет извън сезона — началото на следващия сезон (тогава не се плаща).
 */
export function unpaidFrom(paidUntil: string | null | undefined, season?: SeasonWindow): string | null {
  return paidUntil ? seasonDayOnOrAfter(addDays(paidUntil, 1), season) : null;
}

/** Ден на просрочие: 1 е първият неплатен ден в сезона, 0 — няма просрочие. */
export function daysOverdue(paidUntil: string | null | undefined, today: string, season?: SeasonWindow): number {
  const from = unpaidFrom(paidUntil, season);
  if (!from || from > today) return 0;
  return Math.round((Date.parse(today) - Date.parse(from)) / 86_400_000) + 1;
}

/**
 * Периодът, който покрива едно месечно плащане по банка — до същата дата
 * следващия месец минус ден (31 януари → 28/29 февруари, не 3 март).
 *
 * Започва от деня след платеното — и при закъснял превод в гратисните 14
 * дни, защото обходите са продължили. От днес започва, ако не е плащано
 * никога, ако обходите са били спрени или закъснението е по-голямо.
 * Сезонен пакет плаща само месеците в сезона: период, който би започнал
 * извън него, започва в първия ден на следващия сезон.
 */
export function billingPeriod(
  paidUntil: string | null | undefined,
  today: string,
  season?: SeasonWindow,
  opts: { suspended?: boolean } = {},
): { from: string; until: string } {
  const due = unpaidFrom(paidUntil, season);
  const late = daysOverdue(paidUntil, today, season);
  const from = due && !opts.suspended && late <= SUSPEND_AFTER_DAYS ? due : seasonDayOnOrAfter(today, season);
  const [y, m, d] = from.split("-").map(Number);
  const lastOfNext = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  // Няма такъв ден следващия месец (31 → февруари) — до последния му ден.
  if (d > lastOfNext) return { from, until: new Date(Date.UTC(y, m, lastOfNext)).toISOString().slice(0, 10) };
  return { from, until: addDays(new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10), -1) };
}
