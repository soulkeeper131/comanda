import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { photoToDataUri } from "./pdf";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import path from "path";

const PHOTOS_DIR = path.join(process.cwd(), "data", "photos");
const FIXTURE = "pdf-test-fixture.png";
const FIXTURE_PATH = path.join(PHOTOS_DIR, FIXTURE);

// Най-малкият валиден PNG — 1x1 прозрачен пиксел
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("photoToDataUri", () => {
  beforeAll(() => {
    if (!existsSync(PHOTOS_DIR)) mkdirSync(PHOTOS_DIR, { recursive: true });
    writeFileSync(FIXTURE_PATH, PNG_1x1);
  });

  afterAll(() => {
    rmSync(FIXTURE_PATH, { force: true });
  });

  it("чете снимка по /api/photos/ път от диска, без HTTP", () => {
    const result = photoToDataUri(`/api/photos/${FIXTURE}`);
    expect(result).toMatch(/^data:image\/png;base64,/);
    expect(result).toContain(PNG_1x1.toString("base64"));
  });

  it("връща data: URI непроменен", () => {
    const original = "data:image/jpeg;base64,AAAA";
    expect(photoToDataUri(original)).toBe(original);
  });

  it("връща null за липсваща снимка", () => {
    expect(photoToDataUri("/api/photos/няма-такава.jpg")).toBeNull();
  });

  it("отказва path traversal", () => {
    expect(photoToDataUri("/api/photos/../../../etc/passwd")).toBeNull();
  });

  it("познава типа по разширението", () => {
    expect(photoToDataUri(`/api/photos/${FIXTURE}`)).toMatch(/^data:image\/png;/);
  });
});
