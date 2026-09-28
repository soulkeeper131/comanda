import { describe, it, expect } from "vitest";
import { scheduleVisits, intervalDays, addMonths, nextWorkingDay, inSeason, genKey } from "./schedule";
import { orthodoxEaster, isHoliday, isoDate } from "./holidays";

describe("orthodoxEaster", () => {
  it("знае реалните дати", () => {
    expect(isoDate(orthodoxEaster(2024))).toBe("2024-05-05");
    expect(isoDate(orthodoxEaster(2025))).toBe("2025-04-20");
    expect(isoDate(orthodoxEaster(2026))).toBe("2026-04-12");
    expect(isoDate(orthodoxEaster(2027))).toBe("2027-05-02");
  });
});

describe("isHoliday", () => {
  it("фиксирани и подвижни празници", () => {
    expect(isHoliday("2026-03-03")).toBe(true);
    expect(isHoliday("2026-04-10")).toBe(true); // Разпети петък
    expect(isHoliday("2026-04-13")).toBe(true); // Великден (понеделник)
    expect(isHoliday("2026-04-14")).toBe(false);
  });
  it("уикендът не е празник", () => {
    expect(isHoliday("2026-10-03")).toBe(false); // събота
  });
});

describe("intervalDays", () => {
  it("1/2/4 на месец", () => {
    expect(intervalDays(4)).toBe(7);
    expect(intervalDays(2)).toBe(14);
    expect(intervalDays(1)).toBe(30);
  });
});

describe("addMonths", () => {
  it("подрязва края на месеца", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-10-15", 3)).toBe("2027-01-15");
  });
});

describe("nextWorkingDay", () => {
  it("прескача поредица празници", () => {
    expect(nextWorkingDay("2026-12-24")).toBe("2026-12-27");
    expect(nextWorkingDay("2026-12-23")).toBe("2026-12-23");
  });
});

describe("scheduleVisits", () => {
  it("генерира три месеца напред на всеки 7 дни", () => {
    const v = scheduleVisits({ firstDate: "2026-10-01", perMonth: 4, today: "2026-10-01" });
    expect(v[0]).toEqual({ seq: 0, date: "2026-10-01" });
    expect(v[1]).toEqual({ seq: 1, date: "2026-10-08" });
    expect(v.at(-1)!.date <= "2027-01-01").toBe(true);
    expect(v.length).toBe(14);
  });

  it("мести само празничната дата, не целия график", () => {
    // 2026-12-10 + 14 = 12-24 (празник) → 12-27; следващата остава 01-07
    const v = scheduleVisits({ firstDate: "2026-12-10", perMonth: 2, today: "2026-12-01" });
    expect(v.map((x) => x.date).slice(0, 3)).toEqual(["2026-12-10", "2026-12-27", "2027-01-07"]);
  });

  it("не създава назад във времето, но пази поредността", () => {
    const v = scheduleVisits({ firstDate: "2026-09-01", perMonth: 4, today: "2026-09-20" });
    expect(v[0].seq).toBe(3);
    expect(v[0].date).toBe("2026-09-23"); // 22 септ. е празник
  });

  it("спира на ends_at", () => {
    const v = scheduleVisits({ firstDate: "2026-10-01", perMonth: 4, today: "2026-10-01", endsAt: "2026-10-20" });
    expect(v.map((x) => x.date)).toEqual(["2026-10-01", "2026-10-08", "2026-10-15"]);
  });

  it("второ пускане със същите данни дава същите ключове", () => {
    const a = scheduleVisits({ firstDate: "2026-10-01", perMonth: 2, today: "2026-10-01" });
    const b = scheduleVisits({ firstDate: "2026-10-01", perMonth: 2, today: "2026-10-05" });
    const keys = (x: typeof a) => x.map((v) => genKey("p", "t", v.seq));
    expect(keys(b).every((k) => keys(a).includes(k))).toBe(true);
  });

  it("сезонен пакет пропуска дати извън сезона", () => {
    const v = scheduleVisits({
      firstDate: "2027-04-01", perMonth: 4, today: "2027-04-01",
      season: { from: "10-01", to: "04-30" },
    });
    expect(v.every((x) => x.date <= "2027-04-30")).toBe(true);
  });
});

describe("inSeason", () => {
  it("прозорец през Нова година", () => {
    expect(inSeason("2027-01-15", "10-01", "04-30")).toBe(true);
    expect(inSeason("2027-07-15", "10-01", "04-30")).toBe(false);
    expect(inSeason("2027-07-15", "05-01", "09-30")).toBe(true);
    expect(inSeason("2027-07-15", null, null)).toBe(true);
  });
});
