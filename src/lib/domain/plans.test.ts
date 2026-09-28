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
