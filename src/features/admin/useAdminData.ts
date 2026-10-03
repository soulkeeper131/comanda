"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { AdminFinding, AdminJob, AdminOffer, AdminPayment, AdminPlan, AdminProperty, AdminUser, Inquiry } from "./types";

export type AdminData = {
  properties: AdminProperty[];
  jobs: AdminJob[];
  findings: AdminFinding[];
  offers: AdminOffer[];
  plans: AdminPlan[];
  users: AdminUser[];
  payments: AdminPayment[];
  inquiries: Inquiry[];
};

export type Resource = keyof AdminData;

const URLS: Record<Resource, string> = {
  properties: "/api/properties",
  jobs: "/api/jobs",
  findings: "/api/findings",
  offers: "/api/offers",
  plans: "/api/plans",
  users: "/api/users?all=1",
  payments: "/api/payments",
  inquiries: "/api/inquiries",
};

const EMPTY: AdminData = { properties: [], jobs: [], findings: [], offers: [], plans: [], users: [], payments: [], inquiries: [] };

/**
 * Данните на админския панел на едно място. Опашките на таблото стъпват на
 * няколко ресурса едновременно, затова ги държим заедно и презареждаме
 * само засегнатия след действие.
 */
export function useAdminData() {
  const [data, setData] = useState<AdminData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (...which: Resource[]) => {
    const targets = which.length ? which : (Object.keys(URLS) as Resource[]);
    const results = await Promise.all(targets.map((r) => api<unknown>(URLS[r])));
    const next: Partial<AdminData> = {};
    let firstError: string | null = null;
    results.forEach((res, i) => {
      const key = targets[i];
      if (!res.ok) {
        firstError ??= res.error;
        return;
      }
      const payload = key === "users" ? (res.data as { users: AdminUser[] }).users : res.data;
      (next as Record<Resource, unknown>)[key] = Array.isArray(payload) ? payload : [];
    });
    setData((prev) => ({ ...prev, ...next }));
    setError(firstError);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    // Опашките се опресняват сами — друг админ или инспектор може да е
    // променил нещо (2–3 админи с еднакви права, въпрос 29).
    const t = setInterval(() => {
      if (document.visibilityState === "visible") reload("jobs", "findings", "offers", "plans", "properties", "payments", "inquiries");
    }, 60_000);
    return () => clearInterval(t);
  }, [reload]);

  return { data, loading, error, reload };
}
