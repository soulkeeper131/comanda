// Дати на клиентския език: "вчера в 14:30", не ISO низове.
export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / (1000 * 60 * 60 * 24));
  const time = d.toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" });
  const date = d.toLocaleDateString("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric" });

  if (diffDays === 0) return `днес в ${time}`;
  if (diffDays === 1) return `вчера в ${time}`;
  if (diffDays > 1 && diffDays < 7) return `преди ${diffDays} дни в ${time}`;
  return `${date} в ${time}`;
}

export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value.toLocaleString("bg-BG", { maximumFractionDigits: 2 })} лв`;
}
