export type FindingStatus = "open" | "quote_requested" | "quoted" | "closed";
export type Severity = "normal" | "urgent";

export const FINDING_STATUSES: FindingStatus[] = ["open", "quote_requested", "quoted", "closed"];

export function isFindingStatus(v: unknown): v is FindingStatus {
  return typeof v === "string" && (FINDING_STATUSES as string[]).includes(v);
}

export function isSeverity(v: unknown): v is Severity {
  return v === "normal" || v === "urgent";
}

/**
 * Може ли клиентът да поиска оферта (въпрос 19). Само за отворена
 * констатация — ако вече има заявка или оферта, второ натискане не прави нищо.
 */
export function canRequestQuote(status: string | null | undefined): boolean {
  return (status ?? "open") === "open";
}

/**
 * Подредба: спешните и незатворените отгоре (въпрос 17), после по дата.
 */
export function sortFindings<T extends { severity?: string | null; status?: string | null; created_at?: string | null }>(
  rows: T[],
): T[] {
  const rank = (r: T) => (r.status === "closed" ? 2 : r.severity === "urgent" ? 0 : 1);
  return [...rows].sort(
    (a, b) => rank(a) - rank(b) || (b.created_at ?? "").localeCompare(a.created_at ?? ""),
  );
}
