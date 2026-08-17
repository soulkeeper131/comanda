import { describe, it, expect } from "vitest";
import { resolveOwningProperty } from "./photos";

describe("resolveOwningProperty", () => {
  it("намира имота през evidence", () => {
    const rows = {
      evidence: [{ storage_path: "/api/photos/a.jpg", job_id: "j1" }],
      jobs: [{ id: "j1", property_id: "p1" }],
      findingPhotos: [],
      findings: [],
    };
    expect(resolveOwningProperty("a.jpg", rows)).toBe("p1");
  });

  it("намира имота през finding_photos", () => {
    const rows = {
      evidence: [],
      jobs: [],
      findingPhotos: [{ storage_path: "/api/photos/b.jpg", finding_id: "f1" }],
      findings: [{ id: "f1", property_id: "p2" }],
    };
    expect(resolveOwningProperty("b.jpg", rows)).toBe("p2");
  });

  it("връща null за непозната снимка", () => {
    const rows = { evidence: [], jobs: [], findingPhotos: [], findings: [] };
    expect(resolveOwningProperty("няма.jpg", rows)).toBeNull();
  });

  it("връща null когато снимката сочи към липсваща задача", () => {
    const rows = {
      evidence: [{ storage_path: "/api/photos/c.jpg", job_id: "изчезнал" }],
      jobs: [],
      findingPhotos: [],
      findings: [],
    };
    expect(resolveOwningProperty("c.jpg", rows)).toBeNull();
  });
});
