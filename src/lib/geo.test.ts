import { describe, it, expect } from "vitest";
import { distanceMeters } from "./geo";

describe("distanceMeters", () => {
  it("връща 0 за една и съща точка", () => {
    const p = { lat: 42.6977, lng: 23.3219 };
    expect(distanceMeters(p, p)).toBe(0);
  });

  it("смята познато разстояние в София", () => {
    // НДК → Орлов мост, ~2.1 км по права линия
    const ndk = { lat: 42.6861, lng: 23.3186 };
    const orlov = { lat: 42.6923, lng: 23.3395 };
    const d = distanceMeters(ndk, orlov);
    expect(d).toBeGreaterThan(1800);
    expect(d).toBeLessThan(2400);
  });

  it("е симетрично", () => {
    const a = { lat: 42.69, lng: 23.32 };
    const b = { lat: 42.70, lng: 23.33 };
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 5);
  });

  it("хваща малки разстояния в метри", () => {
    const a = { lat: 42.690000, lng: 23.320000 };
    const b = { lat: 42.690450, lng: 23.320000 };
    expect(distanceMeters(a, b)).toBeGreaterThan(40);
    expect(distanceMeters(a, b)).toBeLessThan(60);
  });
});
