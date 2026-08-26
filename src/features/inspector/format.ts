// Дати на инспекторския език — ден от седмицата, не ISO низове.

/** Начало на деня (местно време), за сравнение по календарен ден. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Ключ по календарен ден (YYYY-MM-DD, локално време) — за групиране. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const WEEKDAYS = ["неделя", "понеделник", "вторник", "сряда", "четвъртък", "петък", "събота"];

/** "днес", "утре", "вчера" или "понеделник, 12 авг." */
export function formatDayLabel(dateKeyValue: string, today: Date = new Date()): string {
  const [y, m, d] = dateKeyValue.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const todayStart = startOfDay(today);
  const diffDays = Math.round((target.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Днес";
  if (diffDays === 1) return "Утре";
  if (diffDays === -1) return "Вчера";

  const weekday = WEEKDAYS[target.getDay()];
  const dateStr = target.toLocaleDateString("bg-BG", { day: "2-digit", month: "short" });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${dateStr}`;
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" });
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const diffDays = Math.round(
    (startOfDay(now).getTime() - startOfDay(d).getTime()) / (1000 * 60 * 60 * 24),
  );
  const time = d.toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" });
  const date = d.toLocaleDateString("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric" });

  if (diffDays === 0) return `днес в ${time}`;
  if (diffDays === 1) return `вчера в ${time}`;
  if (diffDays > 1 && diffDays < 7) return `преди ${diffDays} дни в ${time}`;
  return `${date} в ${time}`;
}
