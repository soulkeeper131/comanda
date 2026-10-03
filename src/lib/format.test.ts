import { describe, it, expect } from "vitest";
import { parseDate, formatWhen, formatDay, formatMoney, addDaysKey, daysFromToday } from "./format";

const now = new Date(2026, 9, 1, 12, 0); // 1 окт 2026, четвъртък

describe("format", () => {
  it("само дата се чете като местна, не UTC", () => {
    const d = parseDate("2026-10-02")!;
    expect(d.getDate()).toBe(2);
    expect(d.getHours()).toBe(0);
  });
  it("обход без час не показва час", () => {
    expect(formatWhen("2026-10-01", now)).toBe("днес");
    expect(formatWhen("2026-10-02", now)).toBe("утре");
    expect(formatDay("2026-10-03", now)).toMatch(/^в събота/);
  });
  it("SQLite datetime е UTC", () => {
    expect(parseDate("2026-10-01 10:00:00")!.toISOString()).toBe("2026-10-01T10:00:00.000Z");
  });
  it("евро", () => {
    expect(formatMoney(45)).toBe("45 €");
  });
  it("дни", () => {
    expect(addDaysKey("2026-10-30", 3)).toBe("2026-11-02");
    expect(daysFromToday("2026-09-29", now)).toBe(-2);
  });
});
