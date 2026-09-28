"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  QUEUE_CHANGED_EVENT,
  getOfflineQueue,
  initOfflineSync,
  syncPending,
  type QueuedAction,
  type RejectedAction,
} from "@/lib/offline-sync";

/** navigator.onLine + събитията online/offline. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

type QueueChange = { pending: QueuedAction[]; rejected: RejectedAction[] };

/** Състоянието на офлайн опашката — чакащи, отхвърлени, синхронизация. */
export function useOfflineQueue() {
  const [pending, setPending] = useState<QueuedAction[]>([]);
  const [rejected, setRejected] = useState<RejectedAction[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    initOfflineSync();
    const q = getOfflineQueue();
    let alive = true;
    Promise.all([q.pending(), q.rejected()]).then(([p, r]) => {
      if (!alive) return;
      setPending(p);
      setRejected(r);
      setLoaded(true);
    });
    const onChange = (e: Event) => {
      const d = (e as CustomEvent<QueueChange>).detail;
      setPending(d.pending);
      setRejected(d.rejected);
    };
    window.addEventListener(QUEUE_CHANGED_EVENT, onChange);
    return () => {
      alive = false;
      window.removeEventListener(QUEUE_CHANGED_EVENT, onChange);
    };
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      return await syncPending();
    } finally {
      setSyncing(false);
    }
  }, []);

  const dismiss = useCallback((actionId: string) => getOfflineQueue().dismissRejected(actionId), []);

  return { pending, rejected, syncing, loaded, sync, dismiss };
}

export type GeoFix = { lat: number; lng: number; at: number };
export type GeoState = { fix: GeoFix | null; error: string | null; locating: boolean };

/**
 * Следи локацията, докато чеклистът е отворен — всяко действие взима
 * координатите от момента, в който е направено (не при синхронизация).
 */
export function useGeoFix(active: boolean) {
  const [state, setState] = useState<GeoState>({ fix: null, error: null, locating: false });
  const [attempt, setAttempt] = useState(0);
  const fixRef = useRef<GeoFix | null>(null);

  useEffect(() => {
    if (!active) return;
    if (!navigator.geolocation) {
      setState({ fix: null, error: "GPS не се поддържа от устройството.", locating: false });
      return;
    }
    setState((s) => ({ ...s, locating: !s.fix, error: null }));
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = { lat: pos.coords.latitude, lng: pos.coords.longitude, at: Date.now() };
        fixRef.current = fix;
        setState({ fix, error: null, locating: false });
      },
      () =>
        setState((s) => ({
          ...s,
          locating: false,
          error: s.fix ? null : "Достъпът до локация е отказан или недостъпен.",
        })),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [active, attempt]);

  /** Координатите "сега" — само ако са от последните 5 минути. */
  const current = useCallback((): { lat: number | null; lng: number | null } => {
    const f = fixRef.current;
    if (!f || Date.now() - f.at > 5 * 60_000) return { lat: null, lng: null };
    return { lat: f.lat, lng: f.lng };
  }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { ...state, current, retry };
}

/** Object URL-и за снимки, които още са само на устройството. */
export function useLocalPhotoUrls(keys: string[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const urlsRef = useRef<Record<string, string>>({});
  const signature = keys.join("|");

  useEffect(() => {
    let alive = true;
    const wanted = new Set(signature ? signature.split("|") : []);
    (async () => {
      const next: Record<string, string> = {};
      for (const key of Array.from(wanted)) {
        if (urlsRef.current[key]) {
          next[key] = urlsRef.current[key];
          continue;
        }
        const blob = await getOfflineQueue().getBlob(key);
        if (blob) next[key] = URL.createObjectURL(blob);
      }
      for (const [key, url] of Object.entries(urlsRef.current)) {
        if (!wanted.has(key)) URL.revokeObjectURL(url);
      }
      if (!alive) {
        for (const [key, url] of Object.entries(next)) if (!urlsRef.current[key]) URL.revokeObjectURL(url);
        return;
      }
      urlsRef.current = next;
      setUrls(next);
    })();
    return () => {
      alive = false;
    };
  }, [signature]);

  useEffect(
    () => () => {
      for (const url of Object.values(urlsRef.current)) URL.revokeObjectURL(url);
    },
    [],
  );

  return urls;
}
