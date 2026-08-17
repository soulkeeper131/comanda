import { describe, it, expect } from "vitest";
import {
  canViewProperty,
  canDecideOffer,
  canCompleteJobItem,
  canOverride,
  isAdmin,
} from "./policy";
import type { SessionData } from "./session";

const admin: SessionData = { uid: "a1", role: "admin", org_id: "org1" };
const owner: SessionData = { uid: "c1", role: "client", org_id: "org1" };
const other: SessionData = { uid: "c2", role: "client", org_id: "org1" };
const inspector: SessionData = { uid: "i1", role: "inspector", org_id: "org1" };

describe("canViewProperty", () => {
  const property = { owner_id: "c1" };

  it("позволява на собственика", () => {
    expect(canViewProperty(owner, property)).toBe(true);
  });
  it("позволява на админ", () => {
    expect(canViewProperty(admin, property)).toBe(true);
  });
  it("позволява на инспектор", () => {
    expect(canViewProperty(inspector, property)).toBe(true);
  });
  it("отказва на друг клиент", () => {
    expect(canViewProperty(other, property)).toBe(false);
  });
  it("отказва на непозната роля дори при съвпадащ uid", () => {
    const strange = { uid: "c1", role: "superuser", org_id: "org1" } as unknown as SessionData;
    expect(canViewProperty(strange, property)).toBe(false);
  });
});

describe("canDecideOffer", () => {
  const property = { owner_id: "c1" };

  it("позволява на собственика — той плаща", () => {
    expect(canDecideOffer(owner, property)).toBe(true);
  });
  it("отказва на админ — не решава от името на клиента", () => {
    expect(canDecideOffer(admin, property)).toBe(false);
  });
  it("отказва на инспектор", () => {
    expect(canDecideOffer(inspector, property)).toBe(false);
  });
  it("отказва на друг клиент", () => {
    expect(canDecideOffer(other, property)).toBe(false);
  });
});

describe("canCompleteJobItem", () => {
  it("позволява на назначения инспектор", () => {
    expect(canCompleteJobItem(inspector, { assignee_id: "i1" })).toBe(true);
  });
  it("отказва на неназначен инспектор", () => {
    expect(canCompleteJobItem({ ...inspector, uid: "i9" }, { assignee_id: "i1" })).toBe(false);
  });
  it("позволява на админ", () => {
    expect(canCompleteJobItem(admin, { assignee_id: "i1" })).toBe(true);
  });
  it("отказва на клиент", () => {
    expect(canCompleteJobItem(owner, { assignee_id: "i1" })).toBe(false);
  });
});

describe("canOverride", () => {
  it("само админ прескача проверки", () => {
    expect(canOverride(admin)).toBe(true);
    expect(canOverride(inspector)).toBe(false);
    expect(canOverride(owner)).toBe(false);
  });
});

describe("isAdmin", () => {
  it("различава админ от останалите", () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(owner)).toBe(false);
  });
});
