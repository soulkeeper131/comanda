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
  it("изтекло платено — започва от днес, не от миналото", () => {
    expect(billingPeriod("2026-09-01", "2026-10-10").from).toBe("2026-10-10");
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
