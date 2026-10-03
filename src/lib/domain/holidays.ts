/**
 * Официалните празници в България (въпрос 9).
 *
 * Офлайн — без външно API. Фиксираните дати са по Кодекса на труда; подвижните
 * (Разпети петък, Велика събота, Великден и понеделник след него) зависят от
 * православния Великден и се смятат, вместо да се поддържа ръчен списък.
 *
 * Уикендите НЕ са празници тук — работи се всеки ден (уточнение 9б).
 * Преместените почивни дни (когато празник падне в събота/неделя) също не се
 * броят: те имат смисъл при петдневна седмица, а обходите вървят всеки ден.
 */

const FIXED: [month: number, day: number, name: string][] = [
  [1, 1, "Нова година"],
  [3, 3, "Ден на Освобождението"],
  [5, 1, "Ден на труда"],
  [5, 6, "Гергьовден"],
  [5, 24, "Ден на славянската писменост"],
  [9, 6, "Ден на Съединението"],
  [9, 22, "Ден на Независимостта"],
  [12, 24, "Бъдни вечер"],
  [12, 25, "Коледа"],
  [12, 26, "Коледа"],
];

/** Православен Великден (Юлиански алгоритъм на Meeus + 13 дни към Григориански). */
export function orthodoxEaster(year: number): Date {
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31); // 3 = март, 4 = април (Юлиански)
  const day = ((d + e + 114) % 31) + 1;
  // Разликата Юлиански → Григориански е 13 дни за 1900–2099.
  return new Date(Date.UTC(year, month - 1, day + 13));
}

/** "YYYY-MM-DD" в UTC. */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDaysUTC(d: Date, days: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days));
}

const cache = new Map<number, Map<string, string>>();

export function holidaysFor(year: number): Map<string, string> {
  const hit = cache.get(year);
  if (hit) return hit;

  const out = new Map<string, string>();
  for (const [m, d, name] of FIXED) {
    out.set(isoDate(new Date(Date.UTC(year, m - 1, d))), name);
  }
  const easter = orthodoxEaster(year);
  out.set(isoDate(addDaysUTC(easter, -2)), "Разпети петък");
  out.set(isoDate(addDaysUTC(easter, -1)), "Велика събота");
  out.set(isoDate(easter), "Великден");
  out.set(isoDate(addDaysUTC(easter, 1)), "Великден");

  cache.set(year, out);
  return out;
}

/** Празник ли е датата ("YYYY-MM-DD")? */
export function isHoliday(date: string): boolean {
  const year = Number(date.slice(0, 4));
  return holidaysFor(year).has(date);
}
