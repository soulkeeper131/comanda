"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { formatWhen } from "@/lib/format";
import AccessInfo from "./AccessInfo";
import CancelVisitSheet from "./CancelVisitSheet";
import ChecklistItemCard from "./ChecklistItemCard";
import OfflineBar from "./OfflineBar";
import PhotoViewer from "./PhotoViewer";
import ReportFindingSheet from "./ReportFindingSheet";
import StartVisitPanel from "./StartVisitPanel";
import { photoWord } from "./format";
import { useGeoFix, useLocalPhotoUrls, useOfflineQueue, useOnline } from "./hooks";
import { useChecklistActions } from "./useChecklistActions";
import { useJobDetail } from "./useJobDetail";
import type { InspectorJob, JobItemDetail } from "./types";

type Props = {
  job: InspectorJob;
  onClose: () => void;
  /** Обходът е завършен/отказан — родителят опреснява списъка. */
  onCompleted: () => void;
};

/**
 * Чеклистът е целият екран — инспекторът работи с телефон на терен, често
 * с ръкавици или на слънце. Мишени ≥44px, едра типография.
 *
 * Работи и без връзка (N2): всяко действие отива в офлайн опашката с
 * координатите и часа от момента, в който е направено; сървърът проверява
 * всичко при изпращането. Отхвърленото се показва с причина.
 */
export default function InspectorChecklist({ job, onClose, onCompleted }: Props) {
  const online = useOnline();
  const queue = useOfflineQueue();
  const { detail, flags, loading, error, source, savedAt, reload } = useJobDetail(job);
  const status = detail?.status ?? job.status;
  const geo = useGeoFix(status === "planned" || status === "in_progress");
  const actions = useChecklistActions({
    job,
    online,
    currentPosition: geo.current,
    reload,
    onCompleted,
  });

  const [reportFor, setReportFor] = useState<{ item: JobItemDetail | null } | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);

  const items = useMemo(() => detail?.items ?? [], [detail]);
  const allPhotos = useMemo(() => [...(detail?.photos ?? []), ...items.flatMap((i) => i.photos)], [detail, items]);
  const localUrls = useLocalPhotoUrls(allPhotos.map((p) => p.localBlobKey).filter((k): k is string => !!k));

  const jobRejected = queue.rejected.filter((r) => r.action.jobId === job.id);
  const jobPending = queue.pending.filter((a) => a.jobId === job.id);
  const rejectedByItem = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of jobRejected) {
      const a = r.action;
      if ((a.kind === "tick" || a.kind === "photo") && a.itemId) m[a.itemId] = r.reason;
    }
    return m;
  }, [jobRejected]);

  const done = items.filter((i) => i.done).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const locked = flags.complete || flags.cancel;
  const editable = status === "in_progress" && !locked;

  const cacheNote =
    source === "cache" && savedAt
      ? `Показано от телефона — запазено ${formatWhen(savedAt)}.`
      : source === "list"
        ? "Обходът не е запазен на телефона — показваме само основното."
        : null;

  const syncNow = async () => {
    await queue.sync();
    if (navigator.onLine) await reload();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="flex flex-shrink-0 items-start gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-bold text-ink">{job.property_name || "Обход"}</h2>
          <p className="truncate text-sm text-muted">{job.title || "Обход"}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-brand-bg text-muted"
          aria-label="Затвори"
        >
          <Icon name="x" size={24} />
        </button>
      </div>

      {detail && status === "in_progress" && <AccessInfo detail={detail} collapsible />}

      <div className="flex-shrink-0 px-4 pt-3 empty:hidden">
        <OfflineBar
          online={online}
          pending={jobPending}
          rejected={jobRejected}
          syncing={queue.syncing}
          onSync={syncNow}
          onDismiss={queue.dismiss}
          cacheNote={cacheNote}
        />
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-muted">Зареждане…</div>
      ) : error || !detail ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-base text-state-danger">{error || "Обходът не може да се зареди."}</p>
          <Button variant="secondary" onClick={() => void reload()}>
            Опитайте отново
          </Button>
        </div>
      ) : status === "planned" ? (
        <StartVisitPanel
          detail={detail}
          geo={geo}
          online={online}
          pendingStart={flags.start}
          starting={actions.starting}
          startError={actions.startError}
          outOfRange={actions.outOfRange}
          onStart={actions.start}
          onCancel={() => setCancelOpen(true)}
        />
      ) : (
        <>
          <div className="flex-shrink-0 px-4 pt-3">
            <div className="h-2.5 overflow-hidden rounded-full bg-brand-bg">
              <div className="h-full rounded-full bg-brand-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-sm text-muted">
              <span>
                {done}/{total} стъпки
              </span>
              <span>
                {allPhotos.length} {photoWord(allPhotos.length)}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {status === "completed" && (
              <p className="mb-3 rounded-card bg-state-ok/10 px-3 py-2 text-sm font-semibold text-state-ok">
                Обходът е завършен.
              </p>
            )}
            {status === "cancelled" && (
              <p className="mb-3 rounded-card bg-line px-3 py-2 text-sm font-semibold text-ink-2">Обходът е отказан.</p>
            )}
            {actions.notice && (
              <div className="mb-3 flex items-start gap-2 rounded-card bg-brand-bg px-3 py-2 text-sm text-brand-secondary">
                <Icon name="check" size={18} className="mt-0.5" />
                <p className="flex-1">{actions.notice}</p>
                <button type="button" onClick={actions.clearNotice} className="-m-2 p-2" aria-label="Скрий">
                  <Icon name="x" size={16} />
                </button>
              </div>
            )}

            <div className="space-y-3">
              {items.map((item) => (
                <ChecklistItemCard
                  key={item.id}
                  item={item}
                  editable={editable}
                  localUrls={localUrls}
                  rejectedReason={rejectedByItem[item.id] ?? null}
                  onToggle={() => void actions.toggle(item)}
                  onPhoto={(file) => void actions.addPhoto(item, file)}
                  onReport={() => setReportFor({ item })}
                  onView={setViewer}
                />
              ))}
              {items.length === 0 && <p className="text-sm text-muted">Обходът няма дефинирани стъпки.</p>}
            </div>

            {editable && (
              <div className="mt-6 flex flex-col items-stretch gap-2 border-t border-line pt-4">
                <Button variant="secondary" size="lg" onClick={() => setReportFor({ item: null })}>
                  <Icon name="alert" size={20} />
                  Докладвай проблем
                </Button>
                <button
                  type="button"
                  onClick={() => setCancelOpen(true)}
                  className="min-h-touch text-sm font-semibold text-state-danger"
                >
                  Откажи обхода
                </button>
              </div>
            )}
          </div>

          {status === "in_progress" && (
            <div
              className="flex-shrink-0 space-y-2 border-t border-line px-4 py-3"
              style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
            >
              {actions.completeError && (
                <p className="rounded-card bg-state-danger/10 px-3 py-2 text-sm text-state-danger">
                  {actions.completeError}
                </p>
              )}
              {locked ? (
                <p className="flex items-center justify-center gap-2 py-2 text-center text-base font-semibold text-state-warning">
                  <Icon name="clock" size={20} />
                  {flags.cancel ? "Отказът чака връзка" : "Завършването чака връзка"}
                </p>
              ) : (
                <Button fullWidth size="lg" disabled={actions.completing} onClick={actions.complete}>
                  {actions.completing ? "Завършване…" : `Завърши обхода (${pct}%)`}
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {reportFor && (
        <ReportFindingSheet
          itemLabel={reportFor.item?.label ?? null}
          online={online}
          onClose={() => setReportFor(null)}
          onSubmit={async (input) => {
            const err = await actions.report(reportFor.item, input);
            if (!err) setReportFor(null);
            return err;
          }}
        />
      )}

      {cancelOpen && (
        <CancelVisitSheet
          propertyName={job.property_name || "Обход"}
          onClose={() => setCancelOpen(false)}
          onSubmit={async (reason) => {
            const err = await actions.cancel(reason);
            if (!err) setCancelOpen(false);
            return err;
          }}
        />
      )}

      {viewer && <PhotoViewer src={viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}
