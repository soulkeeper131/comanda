import { describe, it, expect } from "vitest";
import { canTransition, allowedTransitions } from "./offers";

describe("преходи на офертата", () => {
  it("позволява приемане и отказ от pending", () => {
    expect(canTransition("pending", "accepted")).toBe(true);
    expect(canTransition("pending", "declined")).toBe(true);
  });

  it("не позволява прескачане от pending директно към paid", () => {
    expect(canTransition("pending", "paid")).toBe(false);
    expect(canTransition("pending", "in_progress")).toBe(false);
    expect(canTransition("pending", "done")).toBe(false);
  });

  it("позволява paid само след accepted", () => {
    expect(canTransition("accepted", "paid")).toBe(true);
    expect(canTransition("declined", "paid")).toBe(false);
  });

  it("следва веригата paid → in_progress → done", () => {
    expect(canTransition("paid", "in_progress")).toBe(true);
    expect(canTransition("in_progress", "done")).toBe(true);
    expect(canTransition("paid", "done")).toBe(false);
  });

  it("declined и done са крайни", () => {
    expect(allowedTransitions("declined")).toEqual([]);
    expect(allowedTransitions("done")).toEqual([]);
  });

  it("не позволява връщане назад", () => {
    expect(canTransition("accepted", "pending")).toBe(false);
    expect(canTransition("paid", "accepted")).toBe(false);
    expect(canTransition("done", "in_progress")).toBe(false);
  });

  it("не позволява преход към себе си", () => {
    expect(canTransition("pending", "pending")).toBe(false);
  });
});
