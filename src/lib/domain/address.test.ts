import { describe, expect, it } from "vitest";
import { fromNominatim, fromPhoton, normalizeQuery, queryHouseNumber, rankHits, type AddressHit } from "./address";

const feature = (p: Record<string, string>, lng = 23.34, lat = 42.69) => ({
  geometry: { coordinates: [lng, lat] as [number, number] },
  properties: { countrycode: "BG", ...p },
});

describe("заявката за адрес", () => {
  it("маха съкращенията, които Nominatim не разбира", () => {
    expect(normalizeQuery("ул. Оборище 45")).toBe("Оборище 45");
    expect(normalizeQuery("бул.Черни връх № 51")).toBe("бул.Черни връх 51");
    expect(normalizeQuery("бул. Черни връх № 51, София")).toBe("Черни връх 51, София");
    expect(normalizeQuery("ж.к. Младост 1 бл. 15")).toBe("Младост 1 бл. 15");
    expect(normalizeQuery("  Витоша   15  ")).toBe("Витоша 15");
  });

  it("познава написания номер", () => {
    expect(queryHouseNumber("Оборище 45")).toBe("45");
    expect(queryHouseNumber("ул. Шипка 6А, София")).toBe("6а");
    expect(queryHouseNumber("№12 Витоша")).toBe("12");
    expect(queryHouseNumber("Оборище")).toBeNull();
  });
});

describe("предложенията от Photon", () => {
  it("сграда с номер — улица, номер, район и град", () => {
    const h = fromPhoton(feature({ type: "house", street: "Оборище", housenumber: "45", county: "Оборище", city: "София", postcode: "1504" }))!;
    expect(h.label).toBe("Оборище 45, Оборище, София");
    expect(h.street).toBe("Оборище 45");
    expect(h.city).toBe("София");
    expect(h.precise).toBe(true);
    expect(h.lat).toBe(42.69);
    expect(h.lng).toBe(23.34);
  });

  it("сграда в София без град — градът идва от областта", () => {
    const h = fromPhoton(feature({ type: "house", street: "Оборище", housenumber: "45", county: "Оборище", state: "София-град" }))!;
    expect(h.city).toBe("София");
    expect(h.label).toBe("Оборище 45, Оборище, София");
  });

  it("улица без номер не е точен адрес", () => {
    const h = fromPhoton(feature({ type: "street", name: "Гладстон", city: "Пловдив" }))!;
    expect(h.label).toBe("Гладстон, Пловдив");
    expect(h.precise).toBe(false);
  });

  it("място с име — адресът отпред, името във втория ред", () => {
    const h = fromPhoton(feature({ type: "house", name: "Мол България", street: "бул. България", housenumber: "69", city: "София" }))!;
    expect(h.label).toBe("бул. България 69, София");
    expect(h.display_name).toContain("Мол България");
  });

  it("извън България — не", () => {
    expect(fromPhoton({ ...feature({ name: "Ниш" }), properties: { countrycode: "RS", name: "Ниш" } })).toBeNull();
  });
});

describe("предложенията от Nominatim", () => {
  it("улица и номер от address", () => {
    const h = fromNominatim({
      lat: "42.6948",
      lon: "23.3432",
      display_name: "45, Оборище, Център, София, България",
      address: { road: "Оборище", house_number: "45", suburb: "Център", city: "София" },
    })!;
    expect(h.label).toBe("Оборище 45, Център, София");
    expect(h.city).toBe("София");
    expect(h.precise).toBe(true);
  });
});

describe("подредба", () => {
  const hit = (label: string, street: string, precise: boolean): AddressHit => ({
    lat: 1,
    lng: 1,
    label,
    display_name: label,
    street,
    city: "София",
    precise,
  });

  it("без повторения; адресът с написания номер — най-горе", () => {
    const ranked = rankHits(
      [
        hit("Оборище, Баня", "Оборище", false),
        hit("Оборище 4, София", "Оборище 4", true),
        hit("Оборище 45, София", "Оборище 45", true),
        hit("оборище 45, софия", "Оборище 45", true),
      ],
      "ул. Оборище 45",
    );
    expect(ranked.map((h) => h.label)).toEqual(["Оборище 45, София", "Оборище 4, София", "Оборище, Баня"]);
  });

  it("без номер — редът на търсачката", () => {
    const ranked = rankHits([hit("B", "B", false), hit("A", "A 1", true)], "обор");
    expect(ranked.map((h) => h.label)).toEqual(["B", "A"]);
  });
});

describe("подредба по град", () => {
  const hit = (label: string, street: string, city: string, precise: boolean): AddressHit => ({
    lat: 1,
    lng: 1,
    label,
    display_name: label,
    street,
    city,
    precise,
  });

  it("написаният град е по-важен от номера", () => {
    const ranked = rankHits(
      [hit("Уилям Гладстон 10, София", "Уилям Гладстон 10", "София", true), hit("Гладстон, Пловдив", "Гладстон", "Пловдив", false)],
      "Пловдив Гладстон 10",
    );
    expect(ranked.map((h) => h.city)).toEqual(["Пловдив", "София"]);
  });
});
