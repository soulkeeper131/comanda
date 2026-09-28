export type PlanLike = { status: string | null; active?: boolean | null; ends_at?: string | null };

/**
 * „Жив" абонамент — чакащ плащане, заявен, активен, или отказан, но още в платения период.
 * Имот има най-много един жив абонамент (въпрос 6).
 */
export function isLivePlan(plan: PlanLike, today: string = new Date().toISOString().slice(0, 10)): boolean {
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
