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
    expect(canReschedule({ ...base, to: "2026-10-01" }).ok).toBe(false); // клиентът — най-рано утре
    expect(canReschedule({ ...base, to: "2026-10-02" }).ok).toBe(true);
    expect(canReschedule({ ...base, isAdmin: true, to: "2026-10-01" }).ok).toBe(true);
  });
  it("само планиран", () => {
    expect(canReschedule({ ...base, status: "in_progress", to: "2026-10-05" }).ok).toBe(false);
  });
  it("админът без горна граница", () => {
    expect(canReschedule({ ...base, isAdmin: true, to: "2026-12-01" }).ok).toBe(true);
  });
  it("не отлага безкрай — границата е от първоначалната дата", () => {
    expect(canReschedule({ ...base, originalDate: "2026-10-03", to: "2026-10-17" }).ok).toBe(true);
    expect(canReschedule({ ...base, originalDate: "2026-10-03", to: "2026-10-18" }).ok).toBe(false);
  });
  it("не след края на абонамента", () => {
    expect(canReschedule({ ...base, planEndsAt: "2026-10-05", to: "2026-10-06" }).ok).toBe(false);
  });
});

import { rescheduleWindow } from "./reschedule";

describe("rescheduleWindow и съседите", () => {
  const base = { status: "planned", today: "2026-10-01", isAdmin: false } as const;
  it("далечен обход — прозорецът е до 14 дни след него, не след днес", () => {
    expect(rescheduleWindow({ today: "2026-10-01", originalDate: "2026-11-01" })).toEqual({ min: "2026-10-02", max: "2026-11-15" });
  });
  it("не се застъпва със следващия обход от абонамента", () => {
    expect(rescheduleWindow({ today: "2026-10-01", originalDate: "2026-10-05", nextDate: "2026-10-12" })!.max).toBe("2026-10-11");
    expect(canReschedule({ ...base, to: "2026-10-12", originalDate: "2026-10-05", nextDate: "2026-10-12" }).ok).toBe(false);
    expect(canReschedule({ ...base, to: "2026-10-11", originalDate: "2026-10-05", nextDate: "2026-10-12" }).ok).toBe(true);
  });
  it("клиентът не мести за днес", () => {
    expect(canReschedule({ ...base, to: "2026-10-01", originalDate: "2026-10-05" }).ok).toBe(false);
  });
  it("няма позволена дата → null", () => {
    expect(rescheduleWindow({ today: "2026-10-01", originalDate: "2026-10-02", nextDate: "2026-10-02" })).toBeNull();
  });
});
