const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Id, генериран от клиента (crypto.randomUUID) за безопасен повтор на заявка. */
export function isClientId(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}

/**
 * Голямо разминаване между времето на устройството и времето на получаване
 * (въпрос 16.5). Офлайн синхронизацията естествено закъснява — отбелязваме,
 * не отхвърляме. Връща минутите разлика или null, ако са близо.
 */
export function clockGapMinutes(clientAt: string | null | undefined, serverAt: string | null | undefined, thresholdMin = 10): number | null {
  if (!clientAt || !serverAt) return null;
  const server = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(serverAt) ? serverAt.replace(" ", "T") + "Z" : serverAt;
  const diff = Math.round((new Date(server).getTime() - new Date(clientAt).getTime()) / 60000);
  if (!Number.isFinite(diff)) return null;
  return Math.abs(diff) >= thresholdMin ? diff : null;
}
