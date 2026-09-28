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

/**
 * Периодът, който покрива едно месечно плащане по банка: от деня след
 * платеното досега (или от днес, ако няма платено или е изтекло) до същата
 * дата следващия месец минус ден. 31 януари → 28/29 февруари, не 3 март.
 */
export function billingPeriod(paidUntil: string | null | undefined, today: string): { from: string; until: string } {
  const from = paidUntil && paidUntil >= today ? addDays(paidUntil, 1) : today;
  const [y, m, d] = from.split("-").map(Number);
  const lastOfNext = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  // Няма такъв ден следващия месец (31 → февруари) — до последния му ден.
  if (d > lastOfNext) return { from, until: new Date(Date.UTC(y, m, lastOfNext)).toISOString().slice(0, 10) };
  return { from, until: addDays(new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10), -1) };
}
