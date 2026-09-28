import { describe, it, expect } from "vitest";
import {
  canTransition,
  requiresPrepayment,
  isExpired,
  dueOfferReminder,
  duePaymentReminder,
  expiryFrom,
  allowedTransitions,
  isValidDecision,
  VALID_DECISIONS,
} from "./offers";

describe("валидните статуси идват от картата", () => {
  it("покрива точно седемте статуса", () => {
    expect([...VALID_DECISIONS].sort()).toEqual(
      ["accepted", "declined", "done", "expired", "in_progress", "paid", "pending"].sort(),
    );
  });

  it("приема познат статус", () => {
    expect(isValidDecision("accepted")).toBe(true);
  });

  it("отхвърля непознат статус и не-низ", () => {
    expect(isValidDecision("платено")).toBe(false);
    expect(isValidDecision("")).toBe(false);
    expect(isValidDecision(null)).toBe(false);
    expect(isValidDecision(42)).toBe(false);
  });
});

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

  it("declined, expired и done са крайни", () => {
    expect(allowedTransitions("declined")).toEqual([]);
    expect(allowedTransitions("expired")).toEqual([]);
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

describe("два потока според сумата (въпрос 22)", () => {
  it("над прага: плаща се преди работата", () => {
    expect(requiresPrepayment(180)).toBe(true);
    expect(canTransition("accepted", "paid", 180)).toBe(true);
    expect(canTransition("accepted", "in_progress", 180)).toBe(false);
  });

  it("под прага: работата тръгва веднага, плаща се след нея", () => {
    expect(requiresPrepayment(60)).toBe(false);
    expect(canTransition("accepted", "in_progress", 60)).toBe(true);
    expect(canTransition("accepted", "paid", 60)).toBe(false);
    expect(canTransition("done", "paid", 60)).toBe(true);
  });

  it("прагът се сменя", () => {
    expect(requiresPrepayment(60, 50)).toBe(true);
  });

  it("изтекла оферта не се приема", () => {
    expect(canTransition("expired", "accepted", 60)).toBe(false);
  });
});

describe("изтичане и напомняния", () => {
  const sent = new Date("2026-10-01T10:00:00Z");
  it("валидна 7 дни", () => {
    const expires = expiryFrom(sent);
    expect(isExpired({ decision: "pending", expires_at: expires }, new Date("2026-10-08T09:00:00Z"))).toBe(false);
    expect(isExpired({ decision: "pending", expires_at: expires }, new Date("2026-10-08T10:00:01Z"))).toBe(true);
    expect(isExpired({ decision: "accepted", expires_at: expires }, new Date("2026-10-20T10:00:00Z"))).toBe(false);
  });

  it("напомняне на 3-ия и 6-ия ден, по веднъж", () => {
    const at = (d: string) => new Date(d);
    expect(dueOfferReminder(sent.toISOString(), 0, at("2026-10-03T10:00:00Z"))).toBe(null);
    expect(dueOfferReminder(sent.toISOString(), 0, at("2026-10-04T11:00:00Z"))).toBe(1);
    expect(dueOfferReminder(sent.toISOString(), 1, at("2026-10-05T11:00:00Z"))).toBe(null);
    expect(dueOfferReminder(sent.toISOString(), 1, at("2026-10-07T11:00:00Z"))).toBe(2);
    expect(dueOfferReminder(sent.toISOString(), 2, at("2026-10-07T12:00:00Z"))).toBe(null);
  });

  it("неплатена работа: 3, 7, 14 ден, по едно наведнъж", () => {
    const done = "2026-10-01T10:00:00Z";
    expect(duePaymentReminder(done, 0, new Date("2026-10-02T10:00:00Z"))).toBe(null);
    expect(duePaymentReminder(done, 0, new Date("2026-10-20T10:00:00Z"))).toBe(1);
    expect(duePaymentReminder(done, 1, new Date("2026-10-08T11:00:00Z"))).toBe(2);
    expect(duePaymentReminder(done, 3, new Date("2026-12-08T11:00:00Z"))).toBe(null);
  });
});
