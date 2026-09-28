// Клиентският екран ползва общия форматер — дати без "03:00" за обходи,
// които са само за деня, и суми в евро.
export {
  formatWhen,
  formatDay,
  formatDateOnly,
  formatMoney,
  perMonthLabel,
  todayKey,
  addDaysKey,
  photoUrl,
  daysFromToday,
  parseDate,
  isDateOnly,
} from "@/lib/format";

const MONTHS = [
  "януари", "февруари", "март", "април", "май", "юни",
  "юли", "август", "септември", "октомври", "ноември", "декември",
];

/** "10-01" → "1 октомври" (сезонни пакети). */
export function formatMonthDay(mmdd: string | null | undefined): string {
  if (!mmdd) return "";
  const [m, d] = mmdd.split("-").map(Number);
  if (!m || !d || m < 1 || m > 12) return mmdd;
  return `${d} ${MONTHS[m - 1]}`;
}
