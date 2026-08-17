import { describe, it, expect } from "vitest";
import { canMarkItemDone } from "./jobs";
import { normalizeOverrideReason, MIN_REASON_LENGTH } from "./overrides";

describe("прагът за причината е един и същ на двете места", () => {
  // Ако тези се разминат, canMarkItemDone би одобрила причина, която
  // recordOverride после отхвърля с грешка — вече след като done: true
  // е записано в базата.
  const justBelow = "x".repeat(MIN_REASON_LENGTH - 1);
  const justAt = "x".repeat(MIN_REASON_LENGTH);
  const photoItem = { proof_type: "photo", label: "Баня" };

  it("отхвърля една и съща твърде къса причина", () => {
    const verdict = canMarkItemDone(photoItem, {
      hasEvidence: false,
      isAdmin: true,
      reason: justBelow,
    });
    expect(verdict.ok).toBe(false);
    expect(() => normalizeOverrideReason(justBelow)).toThrow();
  });

  it("приема една и съща причина на границата", () => {
    const verdict = canMarkItemDone(photoItem, {
      hasEvidence: false,
      isAdmin: true,
      reason: justAt,
    });
    expect(verdict.ok).toBe(true);
    expect(normalizeOverrideReason(justAt)).toBe(justAt);
  });
});

describe("canMarkItemDone", () => {
  const photoItem = { proof_type: "photo", label: "Баня" };
  const noteItem = { proof_type: "note", label: "Бележка" };

  it("отказва снимкова стъпка без снимка", () => {
    const r = canMarkItemDone(photoItem, { hasEvidence: false, isAdmin: false, reason: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("снимка");
  });

  it("позволява снимкова стъпка със снимка", () => {
    expect(canMarkItemDone(photoItem, { hasEvidence: true, isAdmin: false, reason: null }).ok).toBe(true);
  });

  it("позволява стъпка без изискване за снимка", () => {
    expect(canMarkItemDone(noteItem, { hasEvidence: false, isAdmin: false, reason: null }).ok).toBe(true);
  });

  it("отказва на инспектор дори с причина — той не прескача", () => {
    const r = canMarkItemDone(photoItem, { hasEvidence: false, isAdmin: false, reason: "камерата не работи" });
    expect(r.ok).toBe(false);
  });

  it("позволява на админ с причина", () => {
    expect(
      canMarkItemDone(photoItem, { hasEvidence: false, isAdmin: true, reason: "камерата на инспектора отказа" }).ok,
    ).toBe(true);
  });

  it("отказва на админ без причина", () => {
    const r = canMarkItemDone(photoItem, { hasEvidence: false, isAdmin: true, reason: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("причина");
  });

  it("отказва на админ с твърде къса причина", () => {
    expect(canMarkItemDone(photoItem, { hasEvidence: false, isAdmin: true, reason: "ок" }).ok).toBe(false);
  });
});
