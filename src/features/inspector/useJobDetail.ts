"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  QUEUE_CHANGED_EVENT,
  cacheGet,
  cacheSet,
  getOfflineQueue,
  jobCacheKey,
  type QueuedAction,
} from "@/lib/offline-sync";
import { applyPending, pendingFlags } from "./pending-overlay";
import type { InspectorJob, JobDetail } from "./types";

type Source = "network" | "cache" | "list";

/**
 * Детайлът на обхода: от сървъра, а без връзка — от кеша на устройството.
 * Върху него се налагат чакащите в опашката действия (снимки, отметки).
 */
export function useJobDetail(job: InspectorJob) {
  const [base, setBase] = useState<JobDetail | null>(null);
  const [pending, setPending] = useState<QueuedAction[]>([]);
  const [source, setSource] = useState<Source>("network");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fromCache = useCallback(async (): Promise<boolean> => {
    const cached = await cacheGet<JobDetail>(jobCacheKey(job.id));
    if (!cached) return false;
    setBase(cached.data);
    setSavedAt(cached.savedAt);
    return true;
  }, [job.id]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}`);
      if (res.ok) {
        const data: JobDetail = await res.json();
        await cacheSet(jobCacheKey(job.id), data);
        setBase(data);
        setSource("network");
        setSavedAt(null);
      } else {
        const d = await res.json().catch(() => ({}));
        if (res.status >= 500 && (await fromCache())) setSource("cache");
        else setError(d.error || "Обходът не може да се зареди.");
      }
    } catch {
      // Без връзка — последното запазено на устройството.
      if (await fromCache()) {
        setSource("cache");
      } else {
        // Минимален запис в кеша, за да може офлайн стартът да го допълни
        // със стъпките, щом сървърът го потвърди.
        const minimal: JobDetail = { ...job, items: [], photos: [] };
        await cacheSet(jobCacheKey(job.id), minimal);
        setBase(minimal);
        setSource("list");
      }
    } finally {
      setLoading(false);
    }
  }, [job, fromCache]);

  useEffect(() => {
    void load();
    void getOfflineQueue()
      .pending()
      .then(setPending);
  }, [load]);

  // Промяна в опашката: кешът вече е обновен със синхронизираното (виж
  // patchCacheAfterSync), затова го четем и сменяме двете заедно — снимката
  // не премигва между "чакаща" и "на сървъра".
  useEffect(() => {
    const onChange = async (e: Event) => {
      const next = (e as CustomEvent<{ pending: QueuedAction[] }>).detail.pending;
      const cached = await cacheGet<JobDetail>(jobCacheKey(job.id));
      if (cached) setBase(cached.data);
      setPending(next);
    };
    window.addEventListener(QUEUE_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(QUEUE_CHANGED_EVENT, onChange);
  }, [job.id]);

  const detail = useMemo(() => (base ? applyPending(base, pending) : null), [base, pending]);
  const flags = useMemo(() => pendingFlags(job.id, pending), [job.id, pending]);

  return { detail, flags, loading, error, source, savedAt, reload: load };
}
