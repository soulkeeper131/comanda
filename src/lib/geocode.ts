import {
  fromNominatim,
  fromPhoton,
  normalizeQuery,
  rankHits,
  type AddressHit,
  type NominatimHit,
  type PhotonFeature,
} from "@/lib/domain/address";

/**
 * Търсене на адреси в България.
 *
 * Photon (komoot) е направен за търсене, докато човек пише: намира и
 * недописани думи („оборищ“), и „ул. Оборище 45“. Nominatim не може нито
 * едното и при натоварване връща HTML вместо JSON — остава само резерва,
 * с изчистена заявка.
 */

const UA = { "User-Agent": "KoManda/1.0 (comanda.bg)" };
// Цяла България; без град в заявката по-близките до София излизат първи.
const BG_BBOX = "22.3,41.2,28.7,44.3";
const SOFIA = { lat: 42.6977, lng: 23.3219 };
const TIMEOUT_MS = 5000;

const cache = new Map<string, { at: number; hits: AddressHit[] }>();
const CACHE_MS = 10 * 60_000;
const CACHE_MAX = 500;

function remember(key: string, hits: AddressHit[]) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), hits });
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function photon(q: string): Promise<AddressHit[] | null> {
  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=10` +
    `&lat=${SOFIA.lat}&lon=${SOFIA.lng}&location_bias_scale=0.3&bbox=${BG_BBOX}`;
  const data = await getJson<{ features?: PhotonFeature[] }>(url);
  if (!data || !Array.isArray(data.features)) return null;
  return data.features.map(fromPhoton).filter((h): h is AddressHit => !!h);
}

async function nominatim(q: string): Promise<AddressHit[] | null> {
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}` +
    `&limit=6&addressdetails=1&countrycodes=bg&accept-language=bg`;
  const data = await getJson<NominatimHit[]>(url);
  if (!Array.isArray(data)) return null;
  return data.map(fromNominatim).filter((h): h is AddressHit => !!h);
}

/** Предложения за написаното; null — и двете търсачки са недостъпни. */
export async function searchAddress(query: string): Promise<AddressHit[] | null> {
  const q = query.replace(/\s+/g, " ").trim();
  const key = q.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.hits;

  let hits = await photon(q);
  if (!hits || hits.length === 0) {
    const fallback = await nominatim(normalizeQuery(q));
    if (fallback) hits = [...(hits ?? []), ...fallback];
  }
  if (!hits) return null;
  const ranked = rankHits(hits, q);
  remember(key, ranked);
  return ranked;
}

/** Адресът на точка — за „Моето местоположение“. */
export async function reverseAddress(lat: number, lng: number): Promise<AddressHit | null> {
  const p = await getJson<{ features?: PhotonFeature[] }>(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&limit=1`);
  const hit = p?.features?.map(fromPhoton).find(Boolean);
  if (hit) return { ...hit, lat, lng };
  const n = await getJson<NominatimHit>(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=bg`,
  );
  const back = n && n.lat ? fromNominatim(n) : null;
  return back ? { ...back, lat, lng } : null;
}

/** Един резултат — когато адресът е написан, а не избран от списъка. */
export async function geocodeOne(query: string): Promise<{ lat: number; lng: number } | null> {
  const hits = await searchAddress(query);
  return hits && hits[0] ? { lat: hits[0].lat, lng: hits[0].lng } : null;
}
