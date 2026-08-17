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

/**
 * Маха коментари и string литерали, за да не лъжат проверката.
 * - Блокови коментари
 * - Едноредови коментари
 * - String литерали
 */
function stripCommentsAndStrings(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // блокови коментари
    .replace(/\/\/.*$/gm, "") // едноредови коментари
    .replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""'); // string литерали
}

/**
 * Проверява дали route файлът е защитен с withAuth.
 * Изисква:
 * 1. Импорт на withAuth от auth модул
 * 2. Реално извикване на withAuth() в кода (без коментари/strings)
 */
export function isGuarded(source: string): boolean {
  const importsGuard = /import\s*\{[^}]*\bwithAuth\b[^}]*\}\s*from\s*["'][^"']*auth["']/.test(source);
  const code = stripCommentsAndStrings(source);
  const callsGuard = /\bwithAuth\s*\(/.test(code);
  return importsGuard && callsGuard;
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
      const guarded = isGuarded(source);
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

describe("детекцията на withAuth не се лъже", () => {
  const withImport = `import { withAuth } from "@/lib/auth";\n`;

  it("не приема коментар за защита", () => {
    expect(isGuarded(`// withAuth ще добавя depois\nexport async function GET() {}`)).toBe(false);
  });

  it("не приема само импорт без извикване", () => {
    expect(isGuarded(`${withImport}export async function GET() {}`)).toBe(false);
  });

  it("не приема withAuth в string литерал", () => {
    expect(isGuarded(`${withImport}const s = "withAuth(";\nexport async function GET() {}`)).toBe(false);
  });

  it("приема реален guard", () => {
    expect(isGuarded(`${withImport}export const GET = withAuth({}, async () => {});`)).toBe(true);
  });

  it("приема guard с роля", () => {
    expect(isGuarded(`${withImport}export const POST = withAuth({ role: ["admin"] }, async () => {});`)).toBe(true);
  });
});
