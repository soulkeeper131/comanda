import { describe, it, expect } from "vitest";
import { isClientId, clockGapMinutes } from "./idempotency";

describe("isClientId", () => {
  it("приема UUID v4, отхвърля останалото", () => {
    expect(isClientId("3b241101-e2bb-4255-8caf-4136c566a962")).toBe(true);
    expect(isClientId("../../etc")).toBe(false);
    expect(isClientId(42)).toBe(false);
  });
});

describe("clockGapMinutes", () => {
  it("отбелязва само голяма разлика", () => {
    expect(clockGapMinutes("2026-10-01T10:00:00Z", "2026-10-01 10:05:00")).toBe(null);
    expect(clockGapMinutes("2026-10-01T10:00:00Z", "2026-10-01 12:00:00")).toBe(120);
    expect(clockGapMinutes(null, "2026-10-01 12:00:00")).toBe(null);
  });
});
