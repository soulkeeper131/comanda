import { describe, expect, it } from "vitest";
import { isValidEmail } from "./email";

describe("isValidEmail", () => {
  it("приема обикновени адреси", () => {
    expect(isValidEmail("ivan.petrov@example.bg")).toBe(true);
    expect(isValidEmail("office+test@sub.comanda.bg")).toBe(true);
  });

  it("отхвърля списъци, имена и празни части", () => {
    for (const bad of ["a,b@c.bg", "Ivan <i@x.bg>", "i@x", "@x.bg", "i@.bg", "i@x..bg", "i x@x.bg", 'a"b@x.bg', "a;b@x.bg"]) {
      expect(isValidEmail(bad)).toBe(false);
    }
  });

  it("отхвърля прекалено дълги адреси веднага", () => {
    expect(isValidEmail(`${"a".repeat(250)}@x.bg`)).toBe(false);
  });

  it("не се бави при злонамерен вход", () => {
    const evil = `${"a@".repeat(1)}${"a.".repeat(50_000)}`;
    const started = Date.now();
    isValidEmail(evil);
    // и без ограничението на дължината регексът е линеен
    /^[^\s@,;:<>()"[\]\\]+@[^\s@,;:<>()"[\]\\.]+(?:\.[^\s@,;:<>()"[\]\\.]+)+$/.test(`a@${"a.".repeat(50_000)}!`);
    expect(Date.now() - started).toBeLessThan(200);
  });
});
