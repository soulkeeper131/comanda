import { describe, it, expect } from "vitest";
import { canRequestQuote, sortFindings } from "./findings";

describe("canRequestQuote", () => {
  it("само за отворена констатация", () => {
    expect(canRequestQuote("open")).toBe(true);
    expect(canRequestQuote(null)).toBe(true);
    expect(canRequestQuote("quote_requested")).toBe(false);
    expect(canRequestQuote("quoted")).toBe(false);
    expect(canRequestQuote("closed")).toBe(false);
  });
});

describe("sortFindings", () => {
  it("спешните отгоре, затворените отдолу", () => {
    const sorted = sortFindings([
      { id: "a", severity: "normal", status: "open", created_at: "2026-10-03" },
      { id: "b", severity: "urgent", status: "open", created_at: "2026-10-01" },
      { id: "c", severity: "urgent", status: "closed", created_at: "2026-10-04" },
      { id: "d", severity: "normal", status: "open", created_at: "2026-10-05" },
    ]);
    expect(sorted.map((f) => f.id)).toEqual(["b", "d", "a", "c"]);
  });
});
