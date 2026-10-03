"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { addDaysKey, formatDay, todayKey } from "@/lib/format";
import JobDetailSheet, { JOB_STATUS } from "./JobDetailSheet";
import NewJobSheet from "./NewJobSheet";
import { Chips, EmptyState, SectionTitle, inputClass } from "./ui";
import type { AdminData, Resource } from "./useAdminData";
import type { AdminJob } from "./types";

type Filter = "upcoming" | "overdue" | "running" | "done" | "cancelled";

/**
 * Графикът — по дни, не календарна решетка. Просрочените стоят отделно и
 * ясно (въпрос 12: „човек решава" значи някой трябва да ги вижда).
 */
export default function JobsSection({
  data,
  reload,
  toast,
}: {
  data: AdminData;
  reload: (...r: Resource[]) => Promise<void>;
  toast: (text: string, tone?: "ok" | "error") => void;
}) {
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [inspector, setInspector] = useState("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<AdminJob | null>(null);
  const [creating, setCreating] = useState(false);
  const today = todayKey();
  const inspectors = data.users.filter((u) => u.role === "inspector" && u.active);

  const buckets = useMemo(() => {
    const d = (j: AdminJob) => j.planned_at.slice(0, 10);
    const monthAgo = addDaysKey(today, -30);
    return {
      upcoming: data.jobs.filter((j) => j.status === "planned" && d(j) >= today),
      overdue: data.jobs.filter((j) => j.status === "planned" && d(j) < today),
      running: data.jobs.filter((j) => j.status === "in_progress"),
      done: data.jobs.filter((j) => j.status === "completed" && (j.completed_at ?? d(j)).slice(0, 10) >= monthAgo),
      cancelled: data.jobs.filter((j) => j.status === "cancelled" && d(j) >= monthAgo),
    };
  }, [data.jobs, today]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = buckets[filter]
      .filter((j) => inspector === "all" || (inspector === "none" ? !j.assignee_id : j.assignee_id === inspector))
      .filter((j) => !q || `${j.property_name} ${j.property_address} ${j.title}`.toLowerCase().includes(q));
    const asc = filter === "upcoming" || filter === "overdue";
    rows.sort((a, b) => (asc ? a.planned_at.localeCompare(b.planned_at) : b.planned_at.localeCompare(a.planned_at)));
    const groups = new Map<string, AdminJob[]>();
    for (const j of rows) {
      const key = j.planned_at.slice(0, 10);
      groups.set(key, [...(groups.get(key) ?? []), j]);
    }
    return Array.from(groups.entries());
  }, [buckets, filter, inspector, search]);

  return (
    <div>
      <SectionTitle
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Icon name="plus" size={16} /> Нов обход
          </Button>
        }
      >
        Обходи
      </SectionTitle>

      <Chips
        value={filter}
        onChange={setFilter}
        options={[
          { value: "upcoming", label: "Предстоящи", count: buckets.upcoming.length },
          { value: "overdue", label: "Просрочени", count: buckets.overdue.length },
          { value: "running", label: "В момента", count: buckets.running.length },
          { value: "done", label: "Завършени (30 дни)" },
          { value: "cancelled", label: "Отказани" },
        ]}
      />
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input className={inputClass} placeholder="Търси по имот или адрес" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={inputClass} value={inspector} onChange={(e) => setInspector(e.target.value)}>
          <option value="all">Всички инспектори</option>
          <option value="none">Невъзложени</option>
          {inspectors.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name || u.email}
            </option>
          ))}
        </select>
      </div>

      {list.length === 0 ? (
        <EmptyState icon="calendar" title="Няма обходи тук" text="Сменете филтъра или създайте нов обход." />
      ) : (
        <div className="space-y-4">
          {list.map(([day, jobs]) => (
            <div key={day}>
              <h3 className={`mb-1.5 text-sm font-bold ${day === today ? "text-brand-primary" : "text-muted"}`}>
                {formatDay(day).replace(/^./, (c) => c.toUpperCase())}
              </h3>
              <div className="space-y-2">
                {jobs.map((j) => {
                  const st = JOB_STATUS[j.status];
                  return (
                    <button key={j.id} onClick={() => setOpen(j)} className="block w-full text-left">
                      <Card padding="sm" className="flex items-center gap-3 transition hover:shadow-card-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-ink">{j.property_name}</div>
                          <div className="truncate text-sm text-muted">
                            {j.title} · {j.assignee_name ?? "невъзложен"}
                          </div>
                          {(j.itemsTotal > 0 || j.photoCount > 0) && (
                            <div className="mt-0.5 flex items-center gap-3 text-xs text-muted">
                              <span>
                                {j.itemsChecked}/{j.itemsTotal} стъпки
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Icon name="camera" size={12} /> {j.photoCount}
                              </span>
                            </div>
                          )}
                        </div>
                        <Badge tone={filter === "overdue" ? "warning" : st.tone}>
                          {filter === "overdue" ? "Просрочен" : st.text}
                        </Badge>
                      </Card>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <JobDetailSheet
        job={open}
        inspectors={inspectors}
        onClose={() => setOpen(null)}
        onChanged={(m) => {
          setOpen(null);
          toast(m);
          reload("jobs");
        }}
      />
      <NewJobSheet
        open={creating}
        properties={data.properties}
        inspectors={inspectors}
        onClose={() => setCreating(false)}
        onCreated={(m) => {
          setCreating(false);
          toast(m);
          reload("jobs");
        }}
      />
    </div>
  );
}
