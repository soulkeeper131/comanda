"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import EmptyToursState from "./EmptyToursState";
import InspectorChecklist from "./InspectorChecklist";
import { dayKey, formatDayLabel, formatTime, startOfDay } from "./format";
import type { InspectorJob } from "./types";

const STATUS_BADGE: Record<InspectorJob["status"], { text: string; tone: "ok" | "warning" | "danger" | "info" | "neutral" }> = {
  planned: { text: "Предстои", tone: "neutral" },
  in_progress: { text: "В момента", tone: "info" },
  completed: { text: "Завършен", tone: "ok" },
  cancelled: { text: "Отказан", tone: "neutral" },
};

/**
 * Инспекторският дом ("Моите обходи" — Task N1). Заменя таб-базирания
 * dashboard за роля inspector, по същия модел като ClientHome.
 *
 * Седмичен изглед, вертикален списък групиран по ден — НЕ календарна
 * решетка (нечетима на 375px). Днес е откроен и е позицията при отваряне.
 * Просрочените (planned, преди днес) са отделна група най-отгоре, не се
 * крият.
 */
export default function InspectorHome() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [jobs, setJobs] = useState<InspectorJob[]>([]);
  const [activeJob, setActiveJob] = useState<InspectorJob | null>(null);
  const todayRef = useRef<HTMLDivElement | null>(null);
  const scrolledRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/jobs");
      if (!res.ok) throw new Error("failed");
      const data: InspectorJob[] = await res.json();
      setJobs(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const today = useMemo(() => startOfDay(new Date()), []);
  const todayKey = useMemo(() => dayKey(today.toISOString()), [today]);

  // Групиране: просрочени (planned, преди днес) отделно най-отгоре, после
  // предстоящи дни (включително днес) в хронологичен ред. Завършени/отказани
  // обходи от миналото не образуват отделни групи — обходът е за седмицата
  // напред, не архив.
  const { overdue, dayGroups } = useMemo(() => {
    const overdueJobs: InspectorJob[] = [];
    const byDay = new Map<string, InspectorJob[]>();

    for (const job of jobs) {
      const key = dayKey(job.planned_at);
      const isPast = key < todayKey;

      if (isPast && job.status === "planned") {
        overdueJobs.push(job);
        continue;
      }
      if (isPast && (job.status === "completed" || job.status === "cancelled")) {
        // Минали и приключени — не претрупват седмичния изглед напред.
        continue;
      }

      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(job);
    }

    overdueJobs.sort((a, b) => new Date(a.planned_at).getTime() - new Date(b.planned_at).getTime());

    const sortedKeys = Array.from(byDay.keys()).sort();
    const groups = sortedKeys.map((key) => ({
      key,
      label: formatDayLabel(key, today),
      isToday: key === todayKey,
      jobs: byDay.get(key)!.sort((a, b) => new Date(a.planned_at).getTime() - new Date(b.planned_at).getTime()),
    }));

    return { overdue: overdueJobs, dayGroups: groups };
  }, [jobs, todayKey, today]);

  // При отваряне скролваме до днешния ден — той е позицията, не най-горе.
  useEffect(() => {
    if (loading || scrolledRef.current) return;
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ block: "start" });
      scrolledRef.current = true;
    }
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
        <p className="text-ink">Възникна грешка при зареждане.</p>
        <button onClick={load} className="text-sm font-semibold text-brand-primary">
          Опитайте отново
        </button>
      </div>
    );
  }

  if (jobs.length === 0) {
    return <EmptyToursState />;
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
      <h1 className="text-xl font-bold text-ink">Моите обходи</h1>

      {overdue.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-state-danger">
            Просрочени · {overdue.length}
          </h2>
          <div className="space-y-2.5">
            {overdue.map((job) => (
              <JobCard key={job.id} job={job} overdue onOpen={() => setActiveJob(job)} />
            ))}
          </div>
        </section>
      )}

      {dayGroups.length === 0 && overdue.length > 0 && (
        <p className="text-sm text-muted">Няма предстоящи обходи тази седмица.</p>
      )}

      {dayGroups.map((group) => (
        <section key={group.key} ref={group.isToday ? todayRef : undefined}>
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
              <JobCard key={job.id} job={job} onOpen={() => setActiveJob(job)} />
            ))}
          </div>
        </section>
      ))}

      {activeJob && (
        <InspectorChecklist
          job={activeJob}
          onClose={() => setActiveJob(null)}
          onCompleted={() => {
            setActiveJob(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function JobCard({ job, overdue, onOpen }: { job: InspectorJob; overdue?: boolean; onOpen: () => void }) {
  const status = STATUS_BADGE[job.status];
  const total = job.itemsTotal ?? 0;
  const checked = job.itemsChecked ?? 0;

  return (
    <button onClick={onOpen} className="block w-full text-left">
      <Card
        padding="md"
        shadow="sm"
        className={`transition hover:shadow-card-2 ${overdue ? "border-state-danger/40" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-ink">{job.property_name || "Имот"}</div>
            <div className="truncate text-sm text-muted">{job.title || "Обход"}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span>{formatTime(job.planned_at)}</span>
              {total > 0 && (
                <span>
                  {checked}/{total} стъпки
                </span>
              )}
              {(job.photoCount ?? 0) > 0 && (
                <span>
                  {job.photoCount} {job.photoCount === 1 ? "снимка" : "снимки"}
                </span>
              )}
            </div>
          </div>
          <Badge tone={overdue ? "danger" : status.tone} className="shrink-0">
            {overdue ? "Просрочен" : status.text}
          </Badge>
        </div>
      </Card>
    </button>
  );
}
