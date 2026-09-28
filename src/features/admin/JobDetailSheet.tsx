"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { addDaysKey, formatDay, formatWhen, photoUrl, todayKey } from "@/lib/format";
import { api } from "./api";
import { clockGapMinutes } from "@/lib/domain/idempotency";
import { Field, inputClass, PhotoStrip, PhotoViewer, ReasonSheet } from "./ui";
import type { AdminJob, AdminUser } from "./types";

type Detail = AdminJob & {
  access_notes: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  items: {
    id: string;
    label: string;
    zone_label: string | null;
    done: boolean | null;
    required: boolean | null;
    evidence_type: string | null;
    photos: { id: string; storage_path: string; taken_at: string | null; client_taken_at: string | null }[];
  }[];
  photos: { id: string; storage_path: string }[];
};

type Override = { entity_id: string; reason: string; created_at: string | null };

export const JOB_STATUS: Record<AdminJob["status"], { text: string; tone: "neutral" | "info" | "ok" | "danger" }> = {
  planned: { text: "Планиран", tone: "neutral" },
  in_progress: { text: "В момента", tone: "info" },
  completed: { text: "Завършен", tone: "ok" },
  cancelled: { text: "Отказан", tone: "danger" },
};

/** Един обход: стъпки със снимките, изпълнител, преместване, отказ. */
export default function JobDetailSheet({
  job,
  inspectors,
  onClose,
  onChanged,
}: {
  job: AdminJob | null;
  inspectors: AdminUser[];
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);

  useEffect(() => {
    setDetail(null);
    setOverrides([]);
    setError("");
    if (!job) return;
    setNewDate(job.planned_at.slice(0, 10));
    api<Detail>(`/api/jobs/${job.id}`).then(async (res) => {
      if (!res.ok) return setError(res.error);
      setDetail(res.data);
      const ids = res.data.items.map((i) => i.id);
      const [items, checkin] = await Promise.all([
        ids.length ? api<Override[]>(`/api/overrides?entity_type=job_item&entity_id=${ids.join(",")}`) : null,
        api<Override[]>(`/api/overrides?entity_type=job_checkin&entity_id=${job.id}`),
      ]);
      setOverrides([...(items?.ok ? items.data : []), ...(checkin.ok ? checkin.data : [])]);
    });
  }, [job]);

  const act = async (fn: () => Promise<{ ok: boolean; error?: string }>, message: string) => {
    setBusy(true);
    setError("");
    const res = await fn();
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "Грешка");
    onChanged(message);
  };

  const status = job ? JOB_STATUS[job.status] : null;
  const checkinOverride = overrides.find((o) => o.entity_id === job?.id);

  return (
    <>
      <Sheet open={!!job && !cancelOpen} onClose={onClose} placement="bottom" className="max-h-[92dvh] overflow-y-auto p-5">
        {job && status && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-ink">{job.property_name}</h3>
                <p className="text-sm text-muted">
                  {job.title} · {formatDay(job.planned_at)}
                </p>
                {job.rescheduled_from && (
                  <p className="text-xs text-muted">Преместен от {formatDay(job.rescheduled_from)}</p>
                )}
              </div>
              <Badge tone={status.tone}>{status.text}</Badge>
            </div>

            {detail && (detail.contact_phone || detail.access_notes) && (
              <div className="rounded-card bg-brand-bg px-3 py-2 text-sm text-ink-2">
                {detail.contact_phone && (
                  <a href={`tel:${detail.contact_phone}`} className="flex items-center gap-1.5 font-semibold text-brand-primary">
                    <Icon name="phone" size={16} /> {detail.contact_name ?? "Контакт"} · {detail.contact_phone}
                  </a>
                )}
                {detail.access_notes && <p className="mt-1">{detail.access_notes}</p>}
              </div>
            )}

            {job.note && <p className="rounded-card bg-state-warning/10 px-3 py-2 text-sm text-state-warning">{job.note}</p>}
            {checkinOverride && (
              <p className="rounded-card bg-state-warning/10 px-3 py-2 text-sm text-state-warning">
                Геофенсингът е прескочен: {checkinOverride.reason}
              </p>
            )}

            {(job.status === "planned" || job.status === "in_progress") && (
              <div className="space-y-3 rounded-card border border-line p-3">
                <Field label="Изпълнител">
                  <select
                    className={inputClass}
                    value={job.assignee_id ?? ""}
                    disabled={busy}
                    onChange={(e) =>
                      act(
                        () => api(`/api/jobs/${job.id}`, { method: "PATCH", body: { assignee_id: e.target.value || null } }),
                        "Изпълнителят е сменен",
                      )
                    }
                  >
                    <option value="">— невъзложен —</option>
                    {inspectors.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email}
                      </option>
                    ))}
                  </select>
                </Field>
                {job.status === "planned" && (
                  <div className="flex items-end gap-2">
                    <Field label="Премести за">
                      <input
                        type="date"
                        className={inputClass}
                        min={todayKey()}
                        max={addDaysKey(todayKey(), 365)}
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                      />
                    </Field>
                    <Button
                      variant="secondary"
                      disabled={busy || !newDate || newDate === job.planned_at.slice(0, 10)}
                      onClick={() =>
                        act(
                          () => api(`/api/jobs/${job.id}/reschedule`, { method: "PATCH", body: { date: newDate } }),
                          "Обходът е преместен",
                        )
                      }
                    >
                      Премести
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div>
              <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
                Стъпки {detail ? `(${detail.items.filter((i) => i.done).length}/${detail.items.length})` : ""}
              </h4>
              {!detail && !error && <p className="text-sm text-muted">Зареждане…</p>}
              {detail && detail.items.length === 0 && (
                <p className="text-sm text-muted">
                  {job.status === "planned" ? "Стъпките се създават, когато обходът започне." : "Няма стъпки."}
                </p>
              )}
              <div className="space-y-2">
                {detail?.items.map((item) => {
                  const skip = overrides.find((o) => o.entity_id === item.id);
                  return (
                    <div key={item.id} className="rounded-card border border-line p-3">
                      <div className="flex items-start gap-2">
                        <Icon
                          name={item.done ? "check-circle" : "clock"}
                          size={18}
                          className={item.done ? "text-state-ok" : "text-muted"}
                        />
                        <div className="min-w-0 flex-1">
                          {item.zone_label && <div className="text-xs font-bold uppercase text-muted">{item.zone_label}</div>}
                          <div className="text-sm font-medium text-ink">{item.label}</div>
                          {skip && <div className="text-xs text-state-warning">Без снимка — {skip.reason}</div>}
                          {item.photos.some((p) => clockGapMinutes(p.client_taken_at, p.taken_at) !== null) && (
                            <div className="text-xs text-muted">
                              Снимано офлайн {formatWhen(item.photos.find((p) => p.client_taken_at)?.client_taken_at)}, получено по-късно
                            </div>
                          )}
                          <PhotoStrip urls={item.photos.map((p) => photoUrl(p.storage_path))} onOpen={setViewer} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {detail && detail.photos.length > 0 && (
                <PhotoStrip urls={detail.photos.map((p) => photoUrl(p.storage_path))} onOpen={setViewer} />
              )}
              {job.completed_at && <p className="mt-2 text-xs text-muted">Завършен {formatWhen(job.completed_at)}</p>}
            </div>

            {error && <p className="rounded-card bg-state-danger/10 px-3 py-2 text-sm text-state-danger">{error}</p>}

            <div className="flex flex-wrap gap-2 pb-2">
              {(job.status === "planned" || job.status === "in_progress") && (
                <Button variant="secondary" onClick={() => setCancelOpen(true)} disabled={busy}>
                  Откажи обхода
                </Button>
              )}
              {job.status === "planned" && !job.plan_id && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    if (confirm("Да изтрия ли този обход? Използвайте само за грешно създаден.")) {
                      act(() => api(`/api/jobs/${job.id}`, { method: "DELETE" }), "Обходът е изтрит");
                    }
                  }}
                >
                  <Icon name="trash" size={16} /> Изтрий
                </Button>
              )}
              <Button variant="ghost" className="ml-auto" onClick={onClose}>
                Затвори
              </Button>
            </div>
          </div>
        )}
      </Sheet>
      <ReasonSheet
        open={cancelOpen}
        title="Отказ на обхода"
        description="Клиентът ще бъде уведомен. Причината остава в историята."
        confirmLabel="Откажи обхода"
        danger
        onClose={() => setCancelOpen(false)}
        onConfirm={async (reason) => {
          if (!job) return;
          const res = await api(`/api/jobs/${job.id}/cancel`, { body: { reason } });
          if (!res.ok) {
            setCancelOpen(false);
            setError(res.error);
            return;
          }
          setCancelOpen(false);
          onChanged("Обходът е отказан");
        }}
      />
      <PhotoViewer url={viewer} onClose={() => setViewer(null)} />
    </>
  );
}
