"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { photoUrl } from "./types";
import type { InspectorJob, JobDetail, JobItemDetail } from "./types";

type Props = {
  job: InspectorJob;
  onClose: () => void;
  /** Обходът е завършен успешно — родителят опреснява списъка. */
  onCompleted: () => void;
};

type GpsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; lat: number; lng: number }
  | { status: "error"; message: string };

/**
 * Чеклистът е целият екран, не панел отстрани — инспекторът работи с
 * телефон на терен, често с ръкавици или на слънце (Task N1). Мишени
 * ≥44px, едра типография, без inline hex стилове — само дизайн токените.
 *
 * За разлика от ChecklistSheet (компонента за клиента/админ панела в
 * dashboard/page.tsx): тук GPS-ът е задължителна стъпка преди старт,
 * директно свързана с /api/jobs/[id]/start (геофенсинг), а не декоративно
 * копче. Снимките са свободен брой на стъпка с брояч, не отметка.
 */
export default function InspectorChecklist({ job, onClose, onCompleted }: Props) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [gps, setGps] = useState<GpsState>({ status: "idle" });
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [outOfRange, setOutOfRange] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [viewerPhoto, setViewerPhoto] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}`);
      if (res.ok) {
        const data: JobDetail = await res.json();
        setDetail(data);
      }
    } finally {
      setLoading(false);
    }
  }, [job.id]);

  useEffect(() => {
    load();
  }, [load]);

  const requestGps = useCallback(() => {
    if (!navigator.geolocation) {
      setGps({ status: "error", message: "GPS не се поддържа от устройството." });
      return;
    }
    setGps({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ status: "ok", lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGps({ status: "error", message: "Достъпът до локация е отказан или недостъпен." }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  // За "planned" задача искаме GPS веднага, за да е готово копчето "Старт".
  useEffect(() => {
    if (job.status === "planned") requestGps();
  }, [job.status, requestGps]);

  const startJob = async () => {
    setStarting(true);
    setStartError(null);
    setOutOfRange(false);
    try {
      const res = await fetch(`/api/jobs/${job.id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: gps.status === "ok" ? gps.lat : undefined,
          lng: gps.status === "ok" ? gps.lng : undefined,
        }),
      });
      if (res.ok) {
        await load();
      } else {
        const d = await res.json().catch(() => ({}));
        setStartError(d.error || "Грешка при стартиране на обхода.");
        // Извън периметъра инспекторът не може да прескочи проверката —
        // само админ може (canOverride в /api/jobs/[id]/start). Не му
        // показваме форма за причина, която сървърът и без друго ще отхвърли.
        setOutOfRange(typeof d.distance_m !== "undefined");
      }
    } catch {
      setStartError("Грешка при връзката. Опитайте отново.");
    } finally {
      setStarting(false);
    }
  };

  const toggleItem = async (item: JobItemDetail) => {
    const nextDone = !item.done;
    if (nextDone && item.evidence_type === "photo" && item.photos.length === 0) {
      // Снимка е задължителна за отмятане — не пращаме заявка без нея,
      // показваме ясно защо копчето за снимка е следващата стъпка.
      return;
    }
    setTogglingId(item.id);
    try {
      const res = await fetch(`/api/job-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: nextDone }),
      });
      if (res.ok) {
        setDetail((prev) =>
          prev
            ? { ...prev, items: prev.items.map((i) => (i.id === item.id ? { ...i, done: nextDone } : i)) }
            : prev,
        );
      }
    } finally {
      setTogglingId(null);
    }
  };

  const addPhoto = async (item: JobItemDetail, file: File) => {
    setUploadingItemId(item.id);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      if (!uploadRes.ok) return;
      const { id: storagePath } = await uploadRes.json();

      const evRes = await fetch("/api/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: job.id, job_item_id: item.id, storage_path: storagePath }),
      });
      if (evRes.ok) {
        const record = await evRes.json();
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.map((i) =>
                  i.id === item.id
                    ? { ...i, photos: [...i.photos, { id: record.id, storage_path: record.storage_path, taken_at: record.taken_at }] }
                    : i,
                ),
              }
            : prev,
        );
      }
    } finally {
      setUploadingItemId(null);
    }
  };

  const handleFileInput = (item: JobItemDetail, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) addPhoto(item, file);
    e.target.value = "";
  };

  const completeJob = async () => {
    setCompleting(true);
    setCompleteError(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/complete`, { method: "POST" });
      if (res.ok) {
        onCompleted();
      } else {
        const d = await res.json().catch(() => ({}));
        if (d.missing_evidence_items?.length) {
          setCompleteError(
            `Липсва снимка за: ${d.missing_evidence_items.map((i: { label: string }) => i.label).join(", ")}`,
          );
        } else if (d.undone_items?.length) {
          setCompleteError(
            `Незавършени задължителни стъпки: ${d.undone_items.map((i: { label: string }) => i.label).join(", ")}`,
          );
        } else {
          setCompleteError(d.error || "Грешка при завършване на обхода.");
        }
      }
    } catch {
      setCompleteError("Грешка при връзката. Опитайте отново.");
    } finally {
      setCompleting(false);
    }
  };

  const items = detail?.items ?? [];
  const done = items.filter((i) => i.done).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const allPhotos = [...(detail?.photos ?? []), ...items.flatMap((i) => i.photos)];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-line px-4 py-3 flex-shrink-0">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold text-ink">{job.property_name || "Обход"}</h2>
          <p className="truncate text-sm text-muted">{job.title || "Обход"}</p>
        </div>
        <button
          onClick={onClose}
          className="flex h-11 w-11 min-h-touch min-w-[44px] flex-shrink-0 items-center justify-center rounded-full bg-brand-bg text-lg text-muted"
          aria-label="Затвори"
        >
          ✕
        </button>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-muted">Зареждане…</div>
        </div>
      ) : job.status === "planned" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-base text-ink">
            За да започнете обхода, трябва да сте на адреса на имота.
          </p>

          {gps.status === "loading" && <p className="text-sm text-muted">Търсене на локация…</p>}
          {gps.status === "error" && (
            <div className="space-y-2">
              <p className="text-sm text-state-danger">{gps.message}</p>
              <Button size="sm" variant="secondary" onClick={requestGps}>
                Опитайте отново
              </Button>
            </div>
          )}
          {gps.status === "ok" && (
            <p className="text-sm font-semibold text-state-ok">
              Локацията е потвърдена ({gps.lat.toFixed(4)}, {gps.lng.toFixed(4)})
            </p>
          )}

          {startError && (
            <div className="w-full max-w-sm space-y-1 rounded-card bg-state-danger/10 px-3 py-2 text-sm text-state-danger">
              <p>{startError}</p>
              {outOfRange && (
                <p className="text-xs">
                  Ако адресът е верен, свържете се с админ — само той може да стартира обход извън обхвата.
                </p>
              )}
            </div>
          )}

          <Button
            size="lg"
            fullWidth
            className="max-w-sm"
            disabled={starting || gps.status === "loading"}
            onClick={startJob}
          >
            {starting ? "Стартиране…" : "Старт на обхода"}
          </Button>
        </div>
      ) : (
        <>
          {/* Progress */}
          <div className="flex-shrink-0 px-4 pt-3">
            <div className="h-2 overflow-hidden rounded-full bg-brand-bg">
              <div
                className="h-full rounded-full bg-brand-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-sm text-muted">
              <span>
                {done}/{total} стъпки
              </span>
              <span>
                {allPhotos.length} {allPhotos.length === 1 ? "снимка" : "снимки"}
              </span>
            </div>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {job.status === "completed" ? (
              <p className="mb-3 rounded-card bg-state-ok/10 px-3 py-2 text-sm font-semibold text-state-ok">
                Обходът е завършен.
              </p>
            ) : null}

            <div className="space-y-3">
              {items.map((item) => {
                const photoCount = item.photos.length;
                const needsPhoto = item.evidence_type === "photo";
                const canToggle = job.status === "in_progress" && (!needsPhoto || photoCount > 0 || item.done);

                return (
                  <div
                    key={item.id}
                    className={`rounded-card border p-4 ${
                      item.done ? "border-brand-primary/30 bg-brand-bg/60" : "border-line bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => canToggle && toggleItem(item)}
                        disabled={!canToggle || togglingId === item.id}
                        className={`flex h-11 w-11 min-h-touch min-w-[44px] flex-shrink-0 items-center justify-center rounded-xl border-2 text-lg font-bold text-white ${
                          item.done ? "border-state-ok bg-state-ok" : "border-line bg-white"
                        } disabled:opacity-50`}
                        aria-label={item.done ? "Отметни като незавършено" : "Отметни като завършено"}
                      >
                        {item.done ? "✓" : ""}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {item.zone_label && (
                            <span className="text-xs font-bold uppercase tracking-wide text-muted">
                              {item.zone_label}
                            </span>
                          )}
                          {item.required && (
                            <Badge tone="warning">Задължително</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-base font-medium leading-snug text-ink">{item.label}</p>

                        {needsPhoto && photoCount === 0 && job.status === "in_progress" && (
                          <p className="mt-1.5 text-sm text-muted">
                            Изисква поне една снимка, преди да се отметне.
                          </p>
                        )}

                        {photoCount > 0 && (
                          <div className="mt-2.5 flex flex-wrap items-center gap-2">
                            <div className="flex flex-wrap gap-2">
                              {item.photos.map((p) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  key={p.id}
                                  src={photoUrl(p.storage_path)}
                                  alt={item.label}
                                  className="h-16 w-16 cursor-pointer rounded-lg border border-line object-cover"
                                  onClick={() => setViewerPhoto(photoUrl(p.storage_path))}
                                />
                              ))}
                            </div>
                            <Badge tone="info">
                              {photoCount} {photoCount === 1 ? "снимка" : "снимки"}
                            </Badge>
                          </div>
                        )}

                        {needsPhoto && job.status === "in_progress" && (
                          <div className="mt-2.5">
                            <label
                              className={`inline-flex min-h-touch cursor-pointer items-center gap-2 rounded-xl border border-brand-primary/30 bg-brand-bg px-4 text-sm font-semibold text-brand-secondary ${
                                uploadingItemId === item.id ? "opacity-50" : ""
                              }`}
                            >
                              {uploadingItemId === item.id
                                ? "Качване…"
                                : photoCount > 0
                                  ? "Добави още снимка"
                                  : "Направи снимка"}
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                disabled={uploadingItemId === item.id}
                                onChange={(e) => handleFileInput(item, e)}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {items.length === 0 && (
                <p className="text-sm text-muted">Обходът няма дефинирани стъпки.</p>
              )}
            </div>
          </div>

          {/* Footer */}
          {job.status === "in_progress" && (
            <div
              className="flex-shrink-0 space-y-2 border-t border-line px-4 py-3"
              style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
            >
              {completeError && (
                <p className="rounded-card bg-state-danger/10 px-3 py-2 text-sm text-state-danger">
                  {completeError}
                </p>
              )}
              <Button fullWidth size="lg" disabled={completing} onClick={completeJob}>
                {completing ? "Завършване…" : `Завърши обхода (${pct}%)`}
              </Button>
            </div>
          )}
        </>
      )}

      {viewerPhoto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
          onClick={() => setViewerPhoto(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewerPhoto} alt="Преглед" className="max-h-full max-w-full object-contain" />
          <button
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center text-2xl text-white"
            onClick={() => setViewerPhoto(null)}
            aria-label="Затвори преглед"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
