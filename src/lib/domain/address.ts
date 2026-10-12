/**
 * Търсене на адрес — чистата част: подготовка на заявката, превръщане на
 * отговорите от Photon и Nominatim в еднакви предложения и подредбата им.
 * Мрежовите заявки са в lib/geocode.ts.
 */

export type AddressHit = {
  lat: number;
  lng: number;
  /** Кратко: „ул. Оборище 45, Оборище, София“. */
  label: string;
  /** По-пълно, за втория ред на предложението. */
  display_name: string;
  /** Улица и номер (или името на мястото) — без града. */
  street: string;
  city: string;
  /** Има ли номер — точен адрес, а не цяла улица или квартал. */
  precise: boolean;
};

export type PhotonProps = {
  type?: string;
  osm_key?: string;
  name?: string;
  street?: string;
  housenumber?: string;
  district?: string;
  locality?: string;
  city?: string;
  county?: string;
  state?: string;
  postcode?: string;
  countrycode?: string;
};
export type PhotonFeature = { geometry: { coordinates: [number, number] }; properties: PhotonProps };

export type NominatimHit = {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
};

const PREFIX = /^(ул|улица|бул|булевард|ж\.?\s?к|жк|кв|пл|площад)\.?\s+/i;

/**
 * Nominatim не намира „ул. Оборище 45“, а „Оборище 45“ — да. Махаме
 * съкращенията пред името и „№“, „No“ пред номера.
 */
export function normalizeQuery(q: string): string {
  return q
    .replace(/\s+/g, " ")
    .split(",")
    .map((part) => part.trim().replace(PREFIX, "").replace(/(№|No\.?)\s*/gi, ""))
    .filter(Boolean)
    .join(", ")
    .trim();
}

/** Номерът, ако човекът го е написал — за подредбата. */
export function queryHouseNumber(q: string): string | null {
  const m = q.match(/(?:^|[\s,№.])(\d+[а-яa-z]?)(?=$|[\s,])/i);
  return m ? m[1].toLowerCase() : null;
}

function cityOf(p: { city?: string; locality?: string; state?: string; county?: string; town?: string; village?: string }): string {
  if (p.city) return p.city;
  if (p.town) return p.town;
  if (p.village) return p.village;
  // Photon понякога пропуска града за сгради в София — областта издава.
  if (p.state === "София-град") return "София";
  return p.locality || p.county || "";
}

function join(parts: (string | undefined | null)[]): string {
  const seen = new Set<string>();
  return parts
    .map((p) => p?.trim())
    .filter((p): p is string => !!p && !seen.has(p.toLowerCase()) && !!seen.add(p.toLowerCase()))
    .join(", ");
}

export function fromPhoton(f: PhotonFeature): AddressHit | null {
  const p = f.properties;
  if (p.countrycode && p.countrycode.toUpperCase() !== "BG") return null;
  const [lng, lat] = f.geometry.coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const city = cityOf(p);
  const area = p.district || (p.county && p.county !== city ? p.county : "");
  const streetLine = p.street ? [p.street, p.housenumber].filter(Boolean).join(" ") : "";
  // Улица без номер идва с името си в name; място (училище, хотел) — с
  // името си в name и адреса в street.
  const main = streetLine || [p.name, p.housenumber].filter(Boolean).join(" ") || city;
  if (!main) return null;
  const place = streetLine && p.name && p.type === "house" ? p.name : "";

  return {
    lat,
    lng,
    label: join([main, area, city]),
    display_name: join([place, main, area, city, p.postcode]),
    street: main === city ? "" : main,
    city,
    precise: !!p.housenumber,
  };
}

export function fromNominatim(hit: NominatimHit): AddressHit | null {
  const a = hit.address ?? {};
  const lat = parseFloat(hit.lat);
  const lng = parseFloat(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const city = cityOf({ city: a.city, town: a.town, village: a.village, state: a.state, county: a.municipality });
  const streetLine = [a.road, a.house_number].filter(Boolean).join(" ");
  const main = streetLine || a.amenity || a.building || hit.display_name.split(",")[0].trim();
  const area = a.suburb || a.neighbourhood || a.city_district || "";
  return {
    lat,
    lng,
    label: join([main, area, city]),
    display_name: hit.display_name,
    street: main,
    city,
    precise: !!a.house_number,
  };
}

/**
 * Без повторения (една сграда често е два обекта в OSM). Най-горе — в
 * написания град, после — с написания номер. Иначе — редът на търсачката.
 */
export function rankHits(hits: AddressHit[], query: string, limit = 6): AddressHit[] {
  const seen = new Set<string>();
  const unique = hits.filter((h) => {
    const key = h.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const q = query.toLowerCase();
  // Търсачката предпочита София; „Пловдив Гладстон 10“ трябва да е в Пловдив.
  // Градът е „написан“ само отделно от улицата — „Оборище 45“ не търси
  // село Оборище.
  const inCity = (h: AddressHit) => {
    const city = h.city.toLowerCase();
    return !!city && q.includes(city) && !h.street.toLowerCase().includes(city);
  };
  const namedCity = unique.some(inCity);
  const num = queryHouseNumber(query);
  const score = (h: AddressHit) => {
    const cityMiss = namedCity && !inCity(h) ? 4 : 0;
    if (!num) return cityMiss;
    const hasNum = new RegExp(`(^|\\s)${num.replace(/[^\dа-яa-z]/gi, "")}(?=$|[\\s,])`, "i").test(h.street);
    return cityMiss + (hasNum ? 0 : h.precise ? 1 : 2);
  };
  return unique
    .map((h, i) => ({ h, i, s: score(h) }))
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.h);
}
