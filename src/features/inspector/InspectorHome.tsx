"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { formatWhen, todayKey as todayKeyOf } from "@/lib/format";
import EmptyToursState from "./EmptyToursState";
import InspectorChecklist from "./InspectorChecklist";
import JobCard from "./JobCard";
import OfflineBar from "./OfflineBar";
import { dayKey, formatDayLabel, sortValue } from "./format";
import { useOfflineQueue, useOnline } from "./hooks";
import { useJobsList } from "./useJobsList";
import type { InspectorJob } from "./types";

const byPlanned = (a: InspectorJob, b: InspectorJob) => sortValue(a.planned_at) - sortValue(b.planned_at);

/**
 * Инспекторският дом ("Моите обходи"). Седмичен изглед, вертикален списък
 * групиран по ден — НЕ календарна решетка (нечетима на 375px). Днес е
 * откроен и е позицията при отваряне. Просрочените са най-отгоре.
 * Без връзка — последно запазеният списък, с лента за това.
 */
export default function InspectorHome() {
  const { jobs, loading, refreshing, error, savedAt, refresh } = useJobsList();
  const online = useOnline();
  const queue = useOfflineQueue();
  const [activeJob, setActiveJob] = useState<InspectorJob | null>(null);
  const todayRef = useRef<HTMLDivElement | null>(null);
  const scrolledRef = useRef(false);

  const todayKey = todayKeyOf();

  const pendingByJob = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of queue.pending) if (a.jobId) m[a.jobId] = (m[a.jobId] ?? 0) + 1;
    return m;
  }, [queue.pending]);

  // Просрочени (planned/in_progress преди днес) отделно най-отгоре, после
  // дните от днес нататък. Минали приключени не претрупват изгледа.
  const { overdue, dayGroups } = useMemo(() => {
    const overdueJobs: InspectorJob[] = [];
    const byDay = new Map<string, InspectorJob[]>();

    for (const job of jobs) {
      const key = dayKey(job.planned_at);
      const isPast = key < todayKey;
      if (isPast && (job.status === "planned" || job.status === "in_progress")) {
        overdueJobs.push(job);
        continue;
      }
      if (isPast) continue;
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(job);
    }

    overdueJobs.sort(byPlanned);
    const groups = Array.from(byDay.keys())
      .sort()
      .map((key) => ({
        key,
        label: formatDayLabel(key),
        isToday: key === todayKey,
        jobs: byDay.get(key)!.sort(byPlanned),
      }));
    return { overdue: overdueJobs, dayGroups: groups };
  }, [jobs, todayKey]);

  // При отваряне скролваме до днешния ден — той е позицията, не най-горе.
  useEffect(() => {
    if (loading || scrolledRef.current || !todayRef.current) return;
    todayRef.current.scrollIntoView({ block: "start" });
    scrolledRef.current = true;
  }, [loading, dayGroups]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-muted">Зареждане на обходите…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        {!online && <Icon name="wifi-off" size={32} className="text-muted" />}
        <p className="text-base text-ink">{error}</p>
        <Button variant="secondary" onClick={refresh} disabled={refreshing}>
          <Icon name="refresh" size={18} />
          Опитайте отново
        </Button>
      </div>
    );
  }

  const checklist = activeJob && (
    <InspectorChecklist
      job={activeJob}
      onClose={() => {
        setActiveJob(null);
        void refresh();
      }}
      onCompleted={() => {
        setActiveJob(null);
        void refresh();
      }}
    />
  );

  if (jobs.length === 0) {
    return <EmptyToursState />;
  }

  return (
    <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">Моите обходи</h1>
        <Button variant="secondary" size="md" onClick={refresh} disabled={refreshing} aria-label="Опресни">
          <Icon name="refresh" size={18} className={refreshing ? "animate-spin" : ""} />
          Опресни
        </Button>
      </div>

      <OfflineBar
        online={online}
        pending={queue.pending}
        rejected={queue.rejected}
        syncing={queue.syncing}
        onSync={async () => {
          await queue.sync();
          if (navigator.onLine) void refresh();
        }}
        onDismiss={queue.dismiss}
        cacheNote={savedAt ? `Показан е списъкът, запазен ${formatWhen(savedAt)}.` : null}
      />

      {overdue.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-state-danger">
            Просрочени · {overdue.length}
          </h2>
          <div className="space-y-2.5">
            {overdue.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                overdue
                pendingCount={pendingByJob[job.id]}
                onOpen={() => setActiveJob(job)}
              />
            ))}
          </div>
        </section>
      )}

      {dayGroups.length === 0 && (
        <p className="text-sm text-muted">Няма предстоящи обходи тази седмица.</p>
      )}

      {dayGroups.map((group) => (
        <section key={group.key} ref={group.isToday ? todayRef : undefined} className="scroll-mt-4">
          <h2
            className={`mb-2 text-sm font-bold uppercase tracking-wide ${
              group.isToday ? "text-brand-primary" : "text-muted"
            }`}
          >
            {group.label} · {group.jobs.length}
          </h2>
          <div
            className={`space-y-2.5 ${
              group.isToday ? "rounded-card border-2 border-brand-primary/30 bg-brand-bg/40 p-2.5" : ""
            }`}
          >
            {group.jobs.map((job) => (
              <JobCard key={job.id} job={job} pendingCount={pendingByJob[job.id]} onOpen={() => setActiveJob(job)} />
            ))}
          </div>
        </section>
      ))}

      {checklist}
    </div>
  );
}
