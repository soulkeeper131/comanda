import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const API_DIR = path.join(process.cwd(), "src", "app", "api");

function findRoutes(dir: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue;
      found.push(...findRoutes(full));
    } else if (entry.name === "route.ts") {
      found.push(full);
    }
  }
  return found;
}

describe("покритие на API routes", () => {
  const routes = findRoutes(API_DIR);

  it("намира route файлове", () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it.each(routes.map((r) => [path.relative(API_DIR, r), r]))(
    "%s използва withAuth или е изрично публичен",
    (_label, file) => {
      const source = fs.readFileSync(file, "utf8");
      const guarded = source.includes("withAuth");
      const publicMarked = source.includes("// @public");

      expect(
        guarded || publicMarked,
        `${path.relative(process.cwd(), file)} няма withAuth. ` +
          `Ако е нарочно публичен, добави коментар "// @public" с обяснение защо.`,
      ).toBe(true);
    },
  );

  it("публичните routes обясняват защо са публични", () => {
    const badlyMarked: string[] = [];
    for (const file of routes) {
      const source = fs.readFileSync(file, "utf8");
      const marker = source.match(/\/\/ @public(.*)/);
      if (marker && marker[1].trim().length < 10) {
        badlyMarked.push(path.relative(API_DIR, file));
      }
    }
    expect(badlyMarked, `Тези @public маркери нямат обяснение: ${badlyMarked.join(", ")}`).toEqual([]);
  });
});
