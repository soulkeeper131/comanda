"use client";

import { useEffect, useState } from "react";
import { api, getOr } from "./api";
import { photoUrl } from "./format";
import { PhotoGrid, type ViewerPhoto } from "./PhotoViewer";
import { Notice } from "./Section";
import type { JobDetail, OverrideRecord } from "./types";

export type JobDetailState = {
  loading: boolean;
  error: string;
  job: JobDetail | null;
  checkinOverride: OverrideRecord | null;
  itemOverrides: Record<string, OverrideRecord>;
};

/**
 * Зарежда обход с точките и снимките му, плюс прескачанията от админ
 * (check-in и стъпки без снимка) — показваме ги честно.
 */
export function useJobDetail(jobId: string | null): JobDetailState {
  const [state, setState] = useState<JobDetailState>({
    loading: !!jobId,
    error: "",
    job: null,
    checkinOverride: null,
    itemOverrides: {},
  });

  useEffect(() => {
    if (!jobId) {
      setState({ loading: false, error: "", job: null, checkinOverride: null, itemOverrides: {} });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: "" }));
    (async () => {
      const res = await api<JobDetail>(`/api/jobs/${jobId}`);
      if (cancelled) return;
      if (!res.ok) {
        setState({ loading: false, error: res.error, job: null, checkinOverride: null, itemOverrides: {} });
        return;
      }
      const job = { ...res.data, items: res.data.items ?? [], photos: res.data.photos ?? [] };
      const itemIds = job.items.map((i) => i.id);
      const [checkin, items] = await Promise.all([
        getOr<OverrideRecord[]>(`/api/overrides?entity_type=job_checkin&entity_id=${job.id}`, []),
        itemIds.length
          ? getOr<OverrideRecord[]>(`/api/overrides?entity_type=job_item&entity_id=${itemIds.join(",")}`, [])
          : Promise.resolve([] as OverrideRecord[]),
      ]);
      if (cancelled) return;
      const byItem: Record<string, OverrideRecord> = {};
      for (const o of items) byItem[o.entity_id] = o;
      setState({ loading: false, error: "", job, checkinOverride: checkin[0] ?? null, itemOverrides: byItem });
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  return state;
}

export function countPhotos(job: JobDetail): number {
  return job.photos.length + job.items.reduce((n, i) => n + i.photos.length, 0);
}

/** Снимките на обхода, групирани по стъпки от чек-листа. */
export function JobPhotosByStep({ state }: { state: JobDetailState }) {
  const { loading, error, job, checkinOverride, itemOverrides } = state;
  if (loading) return <p className="text-sm text-muted">Зареждане на снимките…</p>;
  if (error) return <Notice tone="danger">{error}</Notice>;
  if (!job) return null;

  const stepsWithPhotos = job.items.filter((i) => i.photos.length > 0);
  const skipped = job.items.filter((i) => i.photos.length === 0 && itemOverrides[i.id]);
  const extra: ViewerPhoto[] = job.photos.map((p) => ({ id: p.id, src: photoUrl(p.storage_path), caption: "Общ изглед" }));

  return (
    <div className="space-y-4">
      {checkinOverride && (
        <Notice tone="warning">
          Проверката при пристигане е прескочена от администратор — причина: {checkinOverride.reason}
        </Notice>
      )}

      {stepsWithPhotos.length === 0 && extra.length === 0 && skipped.length === 0 && (
        <p className="text-sm text-muted">Няма прикачени снимки за този обход.</p>
      )}

      {stepsWithPhotos.map((item) => {
        const caption = [item.zone_label, item.label].filter(Boolean).join(" — ");
        return (
          <div key={item.id} className="space-y-1.5">
            <p className="text-sm font-semibold text-ink">
              {item.zone_label && <span className="text-muted">{item.zone_label} · </span>}
              {item.label}
            </p>
            <PhotoGrid
              photos={item.photos.map((p) => ({ id: p.id, src: photoUrl(p.storage_path), caption }))}
            />
          </div>
        );
      })}

      {extra.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-ink">Общ изглед</p>
          <PhotoGrid photos={extra} />
        </div>
      )}

      {skipped.map((item) => (
        <Notice key={item.id} tone="warning">
          „{item.label}“ — без снимка, прескочено от администратор. Причина: {itemOverrides[item.id].reason}
        </Notice>
      ))}
    </div>
  );
}
