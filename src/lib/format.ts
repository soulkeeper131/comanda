// Общото форматиране за всички екрани: дати на човешки език, суми в евро.
// planned_at може да е само дата ("2026-10-01") — обходът е за деня, без час
// (въпрос 7), затова тогава не показваме час.

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Парсва ISO или "YYYY-MM-DD" (като местна дата, не UTC полунощ). */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  if (DATE_ONLY.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  // SQLite datetime('now') е "YYYY-MM-DD HH:MM:SS" в UTC
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value) ? value.replace(" ", "T") + "Z" : value;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isDateOnly(value: string | null | undefined): boolean {
  return !!value && DATE_ONLY.test(value);
}

const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();

/** Разлика в календарни дни: положителна = в бъдещето. */
export function daysFromToday(value: string | null | undefined, now: Date = new Date()): number | null {
  const d = parseDate(value);
  if (!d) return null;
  return Math.round((startOfDay(d) - startOfDay(now)) / 86_400_000);
}

const WEEKDAYS = ["неделя", "понеделник", "вторник", "сряда", "четвъртък", "петък", "събота"];

/** "днес", "утре", "в петък, 03.10", "03.10.2026". */
export function formatDay(value: string | null | undefined, now: Date = new Date()): string {
  const d = parseDate(value);
  if (!d) return "";
  const diff = daysFromToday(value, now)!;
  if (diff === 0) return "днес";
  if (diff === 1) return "утре";
  if (diff === -1) return "вчера";
  const short = d.toLocaleDateString("bg-BG", { day: "2-digit", month: "2-digit" });
  if (diff > 1 && diff < 7) return `в ${WEEKDAYS[d.getDay()]}, ${short}`;
  return d.toLocaleDateString("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** "днес в 14:30", "вчера в 09:10", "03.10.2026 в 12:00"; само дата — без час. */
export function formatWhen(value: string | null | undefined, now: Date = new Date()): string {
  const d = parseDate(value);
  if (!d) return "";
  if (isDateOnly(value)) return formatDay(value, now);
  const diff = daysFromToday(value, now)!;
  const time = d.toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" });
  if (diff === 0) return `днес в ${time}`;
  if (diff === -1) return `вчера в ${time}`;
  if (diff < -1 && diff > -7) return `преди ${-diff} дни в ${time}`;
  return `${d.toLocaleDateString("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric" })} в ${time}`;
}

export function formatDateOnly(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return "";
  return d.toLocaleDateString("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Суми в евро (България е в еврозоната от 2026). */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  // Цяла сума без стотинки ("60 €"), иначе винаги две ("12,50 €") — еднакво в
  // приложението, имейлите и PDF-ите.
  const whole = Number.isInteger(Math.round(value * 100) / 100);
  return `${value.toLocaleString("bg-BG", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })} €`;
}

/** Днешната дата като "YYYY-MM-DD" (местно време) — за <input type="date">. */
export function todayKey(now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

export function addDaysKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return todayKey(new Date(y, m - 1, d + days));
}

export function perMonthLabel(n: number | null | undefined): string {
  if (n === 4) return "всяка седмица";
  if (n === 2) return "на всеки две седмици";
  if (n === 1) return "веднъж месечно";
  return `${n ?? "?"} пъти месечно`;
}

export function photoUrl(storagePath: string): string {
  const name = storagePath.split("/").pop() || storagePath;
  return `/api/photos/${name}`;
}

export type PaymentKind = "offer" | "order" | "plan";

/**
 * Основание за банков превод — различно за ремонт, услуга и абонамент и
 * уникално по id, за да се разпознае кой превод за кое е.
 */
export function bankReference(kind: PaymentKind, id: string): string {
  const label = kind === "offer" ? "Ремонт" : kind === "order" ? "Услуга" : "Абонамент";
  return `${label} ${id.slice(0, 8).toUpperCase()}`;
}

/** Основанието на вече създадено плащане. */
export function paymentReference(p: { offer_id?: string | null; order_id?: string | null; plan_id?: string | null }): string | null {
  if (p.offer_id) return bankReference("offer", p.offer_id);
  if (p.order_id) return bankReference("order", p.order_id);
  if (p.plan_id) return bankReference("plan", p.plan_id);
  return null;
}
