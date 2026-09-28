// Дати на инспекторския език — ден от седмицата, не ISO низове.
// planned_at обикновено е само дата ("2026-10-01"): new Date() би я прочел
// като UTC полунощ (грешен ден източно/западно от Гринуич), затова всичко
// минава през parseDate от общия форматер.

import { parseDate, isDateOnly, todayKey } from "@/lib/format";

export { formatWhen } from "@/lib/format";

/** Начало на деня (местно време), за сравнение по календарен ден. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Ключ по календарен ден (YYYY-MM-DD, локално време) — за групиране. */
export function dayKey(value: string | null | undefined): string {
  const d = parseDate(value);
  return d ? todayKey(d) : "";
}

/** Сортиране в рамките на деня: обходи с час по часа, само-дата най-отпред. */
export function sortValue(value: string | null | undefined): number {
  return parseDate(value)?.getTime() ?? 0;
}

const WEEKDAYS = ["неделя", "понеделник", "вторник", "сряда", "четвъртък", "петък", "събота"];

/** "Днес", "Утре", "Вчера" или "Понеделник, 12 окт." */
export function formatDayLabel(dateKeyValue: string, today: Date = new Date()): string {
  const target = parseDate(dateKeyValue);
  if (!target) return "";
  const diffDays = Math.round((target.getTime() - startOfDay(today).getTime()) / 86_400_000);

  if (diffDays === 0) return "Днес";
  if (diffDays === 1) return "Утре";
  if (diffDays === -1) return "Вчера";

  const weekday = WEEKDAYS[target.getDay()];
  const dateStr = target.toLocaleDateString("bg-BG", { day: "2-digit", month: "short" });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${dateStr}`;
}

/** Час на обхода; празно, ако обходът е "за деня" (само дата). */
export function formatTime(value: string | null | undefined): string {
  if (!value || isDateOnly(value)) return "";
  const d = parseDate(value);
  if (!d) return "";
  return d.toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" });
}

/** "12.10" — кратка дата за "преместен от …". */
export function formatShortDate(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return "";
  return d.toLocaleDateString("bg-BG", { day: "2-digit", month: "2-digit" });
}

export function photoWord(n: number): string {
  return n === 1 ? "снимка" : "снимки";
}
