"use client";

import { useCallback, useEffect, useState } from "react";
import { JOBS_CACHE_KEY, cacheGet, cacheSet, jobCacheKey } from "@/lib/offline-sync";
import { addDaysKey, todayKey } from "@/lib/format";
import { dayKey } from "./format";
import type { InspectorJob, JobDetail } from "./types";

/**
 * Детайлите, които запазваме предварително на телефона: започнатите обходи и
 * тези до утре (вкл. просрочените) — за да се отворят и без връзка.
 */
function shouldPrefetch(job: InspectorJob, tomorrow: string): boolean {
  if (job.status === "in_progress") return true;
  return job.status === "planned" && dayKey(job.planned_at) <= tomorrow;
}

async function prefetchDetails(jobs: InspectorJob[]) {
  const tomorrow = addDaysKey(todayKey(), 1);
  for (const job of jobs.filter((j) => shouldPrefetch(j, tomorrow)).slice(0, 20)) {
    try {
      const res = await fetch(`/api/jobs/${job.id}`);
      if (res.ok) await cacheSet<JobDetail>(jobCacheKey(job.id), await res.json());
    } catch {
      return; // връзката падна — спираме, ще опитаме при следващото опресняване
    }
  }
}

/** Списъкът с обходи — от сървъра, а без връзка от последно запазения. */
export function useJobsList() {
  const [jobs, setJobs] = useState<InspectorJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw Object.assign(new Error(d.error || "Грешка при зареждане на обходите."), { http: res.status });
      }
      const data: InspectorJob[] = await res.json();
      setJobs(data);
      setSavedAt(null);
      await cacheSet(JOBS_CACHE_KEY, data);
      void prefetchDetails(data);
    } catch (err) {
      const http = (err as { http?: number }).http;
      const cached = http && http < 500 ? undefined : await cacheGet<InspectorJob[]>(JOBS_CACHE_KEY);
      if (cached) {
        setJobs(cached.data);
        setSavedAt(cached.savedAt);
      } else {
        setError(err instanceof Error && http ? err.message : "Няма връзка и няма запазени обходи на телефона.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  // Връзката се върна — опресняваме тихо.
  useEffect(() => {
    const onOnline = () => void load();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [load]);

  return { jobs, loading, refreshing, error, savedAt, refresh: () => load() };
}
