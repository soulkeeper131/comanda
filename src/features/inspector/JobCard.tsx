"use client";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { formatShortDate, formatTime, photoWord } from "./format";
import type { InspectorJob } from "./types";

const STATUS_BADGE: Record<InspectorJob["status"], { text: string; tone: "ok" | "warning" | "danger" | "info" | "neutral" }> = {
  planned: { text: "Предстои", tone: "neutral" },
  in_progress: { text: "В момента", tone: "info" },
  completed: { text: "Завършен", tone: "ok" },
  cancelled: { text: "Отказан", tone: "neutral" },
};

type Props = {
  job: InspectorJob;
  overdue?: boolean;
  /** Брой чакащи офлайн действия по обхода. */
  pendingCount?: number;
  onOpen: () => void;
};

export default function JobCard({ job, overdue, pendingCount = 0, onOpen }: Props) {
  const status = STATUS_BADGE[job.status];
  const total = job.itemsTotal ?? 0;
  const checked = job.itemsChecked ?? 0;
  const time = formatTime(job.planned_at);
  const unassigned = !job.assignee_id;
  const movedFrom = job.rescheduled_from ? formatShortDate(job.rescheduled_from) : "";

  return (
    <button type="button" onClick={onOpen} className="block w-full text-left">
      <Card
        padding="md"
        shadow="sm"
        className={`transition hover:shadow-card-2 ${overdue ? "border-state-danger/40" : ""} ${
          unassigned ? "border-dashed border-brand-accent/50" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold text-ink">{job.property_name || "Имот"}</div>
            {job.property_address && (
              <div className="flex items-center gap-1 truncate text-sm text-ink-2">
                <Icon name="pin" size={14} />
                <span className="truncate">{job.property_address}</span>
              </div>
            )}
            <div className="truncate text-sm text-muted">{job.title || "Обход"}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              {time && (
                <span className="inline-flex items-center gap-1">
                  <Icon name="clock" size={12} />
                  {time}
                </span>
              )}
              {total > 0 && (
                <span>
                  {checked}/{total} стъпки
                </span>
              )}
              {(job.photoCount ?? 0) > 0 && (
                <span>
                  {job.photoCount} {photoWord(job.photoCount ?? 0)}
                </span>
              )}
              {movedFrom && <span className="font-semibold text-state-warning">Преместен от {movedFrom}</span>}
              {pendingCount > 0 && (
                <span className="inline-flex items-center gap-1 font-semibold text-state-warning">
                  <Icon name="upload" size={12} />
                  {pendingCount} чакат връзка
                </span>
              )}
            </div>
            {unassigned && (
              <Badge tone="accent" className="mt-2">
                Невъзложен — може да го поемете
              </Badge>
            )}
          </div>
          <Badge tone={overdue ? "danger" : status.tone} className="shrink-0">
            {overdue ? "Просрочен" : status.text}
          </Badge>
        </div>
      </Card>
    </button>
  );
}
