import { describe, it, expect } from "vitest";
import { parseOptionSnapshot, parsePackageInput } from "./packages";

const base = {
  name: "Стандарт",
  per_month: 2,
  price: 45,
  items: [{ template_id: "t1" }, { template_id: "t2", optional: true, per_month: 1, extra_price: 35 }],
};

describe("parsePackageInput", () => {
  it("приема валиден пакет", () => {
    const r = parsePackageInput(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.items[0]).toEqual({ template_id: "t1", per_month: 2, optional: false, extra_price: 0 });
      expect(r.value.items[1].extra_price).toBe(35);
    }
  });

  it("иска точно една основна услуга", () => {
    expect(parsePackageInput({ ...base, items: [{ template_id: "t2", optional: true }] }).ok).toBe(false);
    expect(parsePackageInput({ ...base, items: [{ template_id: "a" }, { template_id: "b" }] }).ok).toBe(false);
  });

  it("честотата е 1, 2 или 4", () => {
    expect(parsePackageInput({ ...base, per_month: 3 }).ok).toBe(false);
  });

  it("сезонът е два края или нищо", () => {
    expect(parsePackageInput({ ...base, active_from: "10-01" }).ok).toBe(false);
    expect(parsePackageInput({ ...base, active_from: "10-01", active_to: "04-30" }).ok).toBe(true);
    expect(parsePackageInput({ ...base, active_from: "13-01", active_to: "04-30" }).ok).toBe(false);
  });

  it("една услуга е в пакета само веднъж", () => {
    const dup = { ...base, items: [{ template_id: "t1" }, { template_id: "t1", optional: true, per_month: 1, extra_price: 10 }] };
    expect(parsePackageInput(dup).ok).toBe(false);
  });

  it("снимката на опциите пази името и цената от заявката", () => {
    expect(parseOptionSnapshot('[{"template_id":"t2","per_month":1,"name":"Почистване","extra_price":35}]')).toEqual([
      { template_id: "t2", per_month: 1, name: "Почистване", extra_price: 35 },
    ]);
    expect(parseOptionSnapshot("не е json")).toEqual([]);
    expect(parseOptionSnapshot('[{"per_month":1}]')).toEqual([]);
  });

  it("цената без отстъпка не е по-малка", () => {
    expect(parsePackageInput({ ...base, list_price: 40 }).ok).toBe(false);
    expect(parsePackageInput({ ...base, list_price: 50 }).ok).toBe(true);
  });
});
