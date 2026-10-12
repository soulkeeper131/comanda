"use client";

import { useEffect, useState } from "react";
import type { AddressHit } from "@/lib/domain/address";

export type { AddressHit };

/**
 * Предложения за адрес, докато човек пише. Изчаква кратка пауза, а старата
 * заявка се прекъсва: иначе по-бавният отговор за „обор“ идваше след този
 * за „оборище 45“ и затриваше верните предложения.
 */
export function useAddressSearch(query: string, enabled: boolean) {
  const [hits, setHits] = useState<AddressHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const q = query.trim();
    if (!enabled || q.length < 3) {
      setHits([]);
      setError("");
      setSearching(false);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setHits([]);
          setError(json.error ?? "Търсенето не успя. Опитайте отново.");
        } else {
          const results = (json.results ?? []) as AddressHit[];
          setHits(results);
          setError(results.length ? "" : "Няма такъв адрес. Пробвайте само улица и номер, например „Оборище 45“.");
        }
        setSearching(false);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setHits([]);
        setError("Търсенето не успя. Проверете връзката.");
        setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, enabled]);

  return { hits, searching, error };
}

/** Адресът там, където е човекът — когато е в самия имот. */
export async function locateAddress(): Promise<{ hit: AddressHit } | { error: string }> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { error: "Телефонът не дава местоположение. Напишете адреса." };
  }
  const pos = await new Promise<GeolocationPosition | GeolocationPositionError>((resolve) =>
    navigator.geolocation.getCurrentPosition(resolve, resolve, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }),
  );
  if (!("coords" in pos)) {
    return {
      error:
        pos.code === pos.PERMISSION_DENIED
          ? "Няма разрешение за местоположение. Разрешете го от настройките на браузъра или напишете адреса."
          : "Не успяхме да определим местоположението. Напишете адреса.",
    };
  }
  try {
    const res = await fetch(`/api/geocode?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.results?.[0]) return { error: json.error ?? "Не открихме адрес на това място. Напишете го." };
    return { hit: json.results[0] as AddressHit };
  } catch {
    return { error: "Търсенето не успя. Проверете връзката." };
  }
}
