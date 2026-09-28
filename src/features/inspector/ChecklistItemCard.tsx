"use client";

import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { photoUrl } from "@/lib/format";
import { photoWord } from "./format";
import type { JobItemDetail } from "./types";

type Props = {
  item: JobItemDetail;
  editable: boolean;
  /** Object URL-и на снимките, които още са само на телефона. */
  localUrls: Record<string, string>;
  /** Причина, ако действие по стъпката е отхвърлено при синхронизация. */
  rejectedReason?: string | null;
  onToggle: () => void;
  onPhoto: (file: File) => void;
  onReport: () => void;
  onView: (url: string) => void;
};

/** Една стъпка от чеклиста — мишени ≥44px, отметка, снимки с брояч, "Докладвай проблем". */
export default function ChecklistItemCard({
  item,
  editable,
  localUrls,
  rejectedReason,
  onToggle,
  onPhoto,
  onReport,
  onView,
}: Props) {
  const photoCount = item.photos.length;
  const pendingPhotos = item.photos.filter((p) => p.localBlobKey).length;
  const needsPhoto = item.evidence_type === "photo";
  const canToggle = editable && (!needsPhoto || photoCount > 0 || Boolean(item.done));

  return (
    <div
      className={`rounded-card border p-4 ${
        rejectedReason
          ? "border-state-danger/50 bg-white"
          : item.done
            ? "border-brand-primary/30 bg-brand-bg/60"
            : "border-line bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => canToggle && onToggle()}
          disabled={!canToggle}
          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border-2 text-white ${
            item.done ? "border-state-ok bg-state-ok" : "border-line bg-white"
          } disabled:opacity-50`}
          aria-label={item.done ? "Отметни като незавършено" : "Отметни като завършено"}
          aria-pressed={Boolean(item.done)}
        >
          {item.done && <Icon name="check" size={26} strokeWidth={3} />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {item.zone_label && (
              <span className="text-xs font-bold uppercase tracking-wide text-muted">{item.zone_label}</span>
            )}
            {item.required && <Badge tone="warning">Задължително</Badge>}
            {item.pendingTick && (
              <Badge tone="neutral">
                <Icon name="clock" size={12} />
                Чака връзка
              </Badge>
            )}
          </div>
          <p className="mt-1 text-lg font-medium leading-snug text-ink">{item.label}</p>

          {rejectedReason && (
            <p className="mt-1.5 flex items-start gap-1.5 text-sm font-semibold text-state-danger">
              <Icon name="alert" size={16} className="mt-0.5" />
              {rejectedReason}
            </p>
          )}

          {needsPhoto && photoCount === 0 && editable && (
            <p className="mt-1.5 text-sm text-muted">Изисква поне една снимка, преди да се отметне.</p>
          )}

          {photoCount > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {item.photos.map((p) => {
                const src = p.localBlobKey ? localUrls[p.localBlobKey] : photoUrl(p.storage_path);
                if (!src) {
                  return <div key={p.id} className="h-16 w-16 animate-pulse rounded-lg bg-brand-bg" />;
                }
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onView(src)}
                    className="relative h-16 w-16 overflow-hidden rounded-lg border border-line"
                    aria-label="Преглед на снимката"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={item.label} className="h-full w-full object-cover" />
                    {p.localBlobKey && (
                      <span className="absolute bottom-0.5 right-0.5 rounded-full bg-state-warning p-0.5 text-white">
                        <Icon name="upload" size={12} title="Чака изпращане" />
                      </span>
                    )}
                  </button>
                );
              })}
              <Badge tone="info">
                {photoCount} {photoWord(photoCount)}
                {pendingPhotos > 0 ? ` · ${pendingPhotos} чакат` : ""}
              </Badge>
            </div>
          )}

          {editable && (
            <div className="mt-3 flex flex-wrap gap-2">
              {needsPhoto && (
                <label className="inline-flex min-h-touch cursor-pointer items-center gap-2 rounded-xl border border-brand-primary/30 bg-brand-bg px-4 text-base font-semibold text-brand-secondary">
                  <Icon name="camera" size={20} />
                  {photoCount > 0 ? "Още снимка" : "Направи снимка"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onPhoto(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
              <button
                type="button"
                onClick={onReport}
                className="inline-flex min-h-touch items-center gap-2 rounded-xl px-3 text-sm font-semibold text-state-danger"
              >
                <Icon name="alert" size={18} />
                Докладвай проблем
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
