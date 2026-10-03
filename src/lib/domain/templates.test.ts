import { describe, expect, it } from "vitest";
import { parseAmount, parseStepInput, parseTemplatePatch } from "./templates";

describe("услуги и чек-листи", () => {
  it("цена със запетая", () => {
    expect(parseAmount("12,50")).toBe(12.5);
    expect(parseAmount(" 1 200 ")).toBe(1200);
    expect(parseTemplatePatch({ price: "25,5" })).toEqual({ ok: true, value: { price: 25.5 } });
  });

  it("отхвърля непознат вид, празно име и абсурдна продължителност", () => {
    expect(parseTemplatePatch({ category: "hack" }).ok).toBe(false);
    expect(parseTemplatePatch({ name: "  " }).ok).toBe(false);
    expect(parseTemplatePatch({ duration_min: 5 }).ok).toBe(false);
    expect(parseTemplatePatch({ price: -1 }).ok).toBe(false);
  });

  it("взима само познатите полета", () => {
    const r = parseTemplatePatch({ name: "Проверка", org_id: "друга", bookable: 0 });
    expect(r).toEqual({ ok: true, value: { name: "Проверка", bookable: false } });
  });

  it("точка от чек-листа — сезон и вид доказателство", () => {
    expect(parseStepInput({ label: "Тръби", season: "winter", proof_type: "photo" }, { create: true })).toEqual({
      ok: true,
      value: { label: "Тръби", season: "winter", proof_type: "photo" },
    });
    expect(parseStepInput({ label: "Х", season: "spring" }, { create: true }).ok).toBe(false);
    expect(parseStepInput({ proof_type: "video" }, { create: false }).ok).toBe(false);
    expect(parseStepInput({ zone_label: "" }, { create: true }).ok).toBe(false);
    expect(parseStepInput({ zone_label: "" }, { create: false })).toEqual({ ok: true, value: { zone_label: null } });
  });
});
