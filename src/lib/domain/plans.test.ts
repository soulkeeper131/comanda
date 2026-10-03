import { describe, it, expect } from "vitest";
import { isLivePlan, endOfPaidPeriod } from "./plans";

describe("isLivePlan", () => {
  it("заявен и активен са живи", () => {
    expect(isLivePlan({ status: "requested" })).toBe(true);
    expect(isLivePlan({ status: "active" })).toBe(true);
  });
  it("отказан — жив до края на периода", () => {
    expect(isLivePlan({ status: "cancelled", ends_at: "2026-10-31" }, "2026-10-15")).toBe(true);
    expect(isLivePlan({ status: "cancelled", ends_at: "2026-10-31" }, "2026-11-01")).toBe(false);
  });
  it("ръчно спрян (active=false) не е жив", () => {
    expect(isLivePlan({ status: "active", active: false })).toBe(false);
  });
});

describe("endOfPaidPeriod", () => {
  it("последния ден на месеца", () => {
    expect(endOfPaidPeriod("2026-02-10")).toBe("2026-02-28");
    expect(endOfPaidPeriod("2026-12-31")).toBe("2026-12-31");
  });
});

import { addDays, billingPeriod, sofiaToday } from "./plans";

describe("billingPeriod", () => {
  it("първо плащане — от днес до деня преди същата дата следващия месец", () => {
    expect(billingPeriod(null, "2026-10-05")).toEqual({ from: "2026-10-05", until: "2026-11-04" });
  });
  it("следващ месец продължава без дупка", () => {
    expect(billingPeriod("2026-11-04", "2026-10-30")).toEqual({ from: "2026-11-05", until: "2026-12-04" });
  });
  it("изтекло платено отдавна — започва от днес, не от миналото", () => {
    expect(billingPeriod("2026-09-01", "2026-10-10").from).toBe("2026-10-10");
  });
  it("закъснял превод в гратисните 14 дни — без дупка, обходите са вървели", () => {
    expect(billingPeriod("2026-10-04", "2026-10-12")).toEqual({ from: "2026-10-05", until: "2026-11-04" });
  });
  it("спрени обходи — новият период е от днес", () => {
    expect(billingPeriod("2026-10-04", "2026-10-25", null, { suspended: true }).from).toBe("2026-10-25");
  });
  it("31 януари → края на февруари", () => {
    expect(billingPeriod(null, "2027-01-31")).toEqual({ from: "2027-01-31", until: "2027-02-28" });
  });
  it("addDays и sofiaToday", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    // 22:30 UTC на 31.12 е вече 1 януари в София
    expect(sofiaToday(new Date("2026-12-31T22:30:00Z"))).toBe("2027-01-01");
  });
});

import { daysOverdue, seasonDayOnOrAfter, unpaidFrom, SUSPEND_AFTER_DAYS } from "./plans";

describe("сезонно плащане", () => {
  const winter = { from: "10-01", to: "04-30" };

  it("извън сезона не се плаща — следващият период е от началото на сезона", () => {
    // платено до 09.05 (последният месец на сезона) → следващият е 01.10
    expect(unpaidFrom("2027-05-09", winter)).toBe("2027-10-01");
    expect(billingPeriod("2027-05-09", "2027-09-25", winter)).toEqual({ from: "2027-10-01", until: "2027-10-31" });
  });

  it("покупка преди сезона плаща от първия ден на сезона", () => {
    expect(billingPeriod(null, "2027-09-10", winter)).toEqual({ from: "2027-10-01", until: "2027-10-31" });
  });

  it("в сезона периодът е обикновеният месец", () => {
    expect(billingPeriod("2027-01-09", "2027-01-05", winter)).toEqual({ from: "2027-01-10", until: "2027-02-09" });
    expect(seasonDayOnOrAfter("2027-01-10", winter)).toBe("2027-01-10");
  });

  it("просрочието се брои от първия неплатен ден в сезона", () => {
    expect(daysOverdue("2027-05-09", "2027-08-01", winter)).toBe(0);
    expect(daysOverdue("2027-05-09", "2027-10-01", winter)).toBe(1);
    expect(daysOverdue("2027-05-09", "2027-10-15", winter)).toBe(SUSPEND_AFTER_DAYS + 1);
    expect(daysOverdue("2026-10-04", "2026-10-05")).toBe(1);
    expect(daysOverdue("2026-10-04", "2026-10-04")).toBe(0);
    expect(daysOverdue(null, "2026-10-04")).toBe(0);
  });
});
