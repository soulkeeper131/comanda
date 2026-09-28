import { describe, it, expect } from "vitest";
import { canReschedule } from "./reschedule";

const base = { status: "planned", today: "2026-10-01", isAdmin: false };

describe("canReschedule", () => {
  it("в рамките на 14 дни", () => {
    expect(canReschedule({ ...base, to: "2026-10-15" }).ok).toBe(true);
    expect(canReschedule({ ...base, to: "2026-10-16" }).ok).toBe(false);
  });
  it("не назад", () => {
    expect(canReschedule({ ...base, to: "2026-09-30" }).ok).toBe(false);
    expect(canReschedule({ ...base, to: "2026-10-01" }).ok).toBe(true);
  });
  it("само планиран", () => {
    expect(canReschedule({ ...base, status: "in_progress", to: "2026-10-05" }).ok).toBe(false);
  });
  it("админът без горна граница", () => {
    expect(canReschedule({ ...base, isAdmin: true, to: "2026-12-01" }).ok).toBe(true);
  });
});
