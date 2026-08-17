import { describe, it, expect } from "vitest";
import { normalizeOverrideReason, recordOverride } from "./overrides";

describe("normalizeOverrideReason", () => {
  it("подрязва празните пространства и връща причината", () => {
    expect(normalizeOverrideReason("  GPS повреден  ")).toBe("GPS повреден");
  });

  it("отхвърля липсваща причина", () => {
    expect(() => normalizeOverrideReason(undefined)).toThrow(
      "Причината за прескачане е задължителна (поне 5 знака).",
    );
  });

  it("отхвърля null причина", () => {
    expect(() => normalizeOverrideReason(null)).toThrow();
  });

  it("отхвърля празен низ", () => {
    expect(() => normalizeOverrideReason("")).toThrow();
  });

  it("отхвърля низ само от интервали", () => {
    expect(() => normalizeOverrideReason("    ")).toThrow();
  });

  it("отхвърля причина под 5 знака", () => {
    expect(() => normalizeOverrideReason("GPS")).toThrow();
  });

  it("приема причина точно на границата от 5 знака", () => {
    expect(normalizeOverrideReason("12345")).toBe("12345");
  });
});

describe("recordOverride", () => {
  it("отхвърля празна причина преди да опита запис в базата", () => {
    expect(() =>
      recordOverride({
        admin_id: "не-съществуващ-admin",
        entity_type: "job_checkin",
        entity_id: "не-съществуваща-задача",
        reason: "",
      }),
    ).toThrow("Причината за прескачане е задължителна (поне 5 знака).");
  });

  it("отхвърля причина само с интервали", () => {
    expect(() =>
      recordOverride({
        admin_id: "не-съществуващ-admin",
        entity_type: "job_checkin",
        entity_id: "не-съществуваща-задача",
        reason: "     ",
      }),
    ).toThrow();
  });
});
