import { describe, it, expect } from "vitest";
import { canMarkItemDone } from "./jobs";

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
