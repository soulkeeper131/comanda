import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, __resetForTests } from "./rate-limit";

function req(ip: string): Request {
  return new Request("http://localhost/api/x", {
    headers: { "x-forwarded-for": ip },
  });
}

describe("checkRateLimit", () => {
  beforeEach(() => __resetForTests());

  it("пуска първата заявка", () => {
    expect(checkRateLimit(req("1.1.1.1"), "/api/x").allowed).toBe(true);
  });

  it("брои надолу остатъка", () => {
    const a = checkRateLimit(req("1.1.1.2"), "/api/x");
    const b = checkRateLimit(req("1.1.1.2"), "/api/x");
    expect(b.remaining).toBe(a.remaining - 1);
  });

  it("блокира след превишаване на лимита за login", () => {
    const ip = "1.1.1.3";
    for (let i = 0; i < 5; i++) checkRateLimit(req(ip), "/api/auth/login");
    expect(checkRateLimit(req(ip), "/api/auth/login").allowed).toBe(false);
  });

  it("разделя лимитите по IP", () => {
    for (let i = 0; i < 5; i++) checkRateLimit(req("1.1.1.4"), "/api/auth/login");
    expect(checkRateLimit(req("1.1.1.5"), "/api/auth/login").allowed).toBe(true);
  });

  it("разделя лимитите по път", () => {
    for (let i = 0; i < 5; i++) checkRateLimit(req("1.1.1.6"), "/api/auth/login");
    expect(checkRateLimit(req("1.1.1.6"), "/api/properties").allowed).toBe(true);
  });
});
