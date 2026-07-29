"use client";

import { useState, useEffect, useMemo } from "react";

type JobRecord = {
  id: string;
  propertyName: string;
  propertyId: string;
  date: string;
  worker: string;
  workerId: string;
  itemsChecked: number;
  itemsTotal: number;
  photoCount: number;
  status: "ok" | "warn" | "bad";
  notes: string;
};

const STATUS_MAP = {
  ok: { label: "✅ OK", color: "#16a34a", bg: "#f0fdf4" },
  warn: { label: "⚠️ Внимание", color: "#d97706", bg: "#fffbeb" },
  bad: { label: "🔴 Проблем", color: "#dc2626", bg: "#fef2f2" },
};

export default function HistoryList() {
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [detailedJob, setDetailedJob] = useState<JobRecord | null>(null);

  useEffect(() => {
    fetch("/api/jobs")
      .then((res) => res.json())
      .then((data) => {
        setJobs(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const propertyNames = useMemo(
    () => [...new Set(jobs.map((j) => j.propertyName))],
    [jobs]
  );

  const filtered = selectedProperty
    ? jobs.filter((j) => j.propertyName === selectedProperty)
    : jobs;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
    );
    const time = d.toLocaleDateString("bg-BG", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    if (diffDays === 0) return `Днес, ${time}`;
    if (diffDays === 1) return `Вчера, ${time}`;
    if (diffDays < 7) return `Преди ${diffDays} дни, ${time}`;
    return time;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-lg" style={{ color: "#247ba0" }}>
          Зареждане...
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center py-12" style={{ color: "#247ba0" }}>
          <div className="text-4xl mb-3">📭</div>
          <div className="text-sm">Няма история на обходи</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {/* Filter */}
      <div className="mb-3">
        <select
          value={selectedProperty}
          onChange={(e) => setSelectedProperty(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border text-base appearance-none"
          style={{
            borderColor: "#e4e9f0",
            fontSize: 16,
            color: "#006494",
            background: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23247ba0' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M2 5l6 6 6-6'/%3e%3c/svg%3e") no-repeat right 12px center/14px`,
            backgroundColor: "#fff",
          }}
        >
          <option value="">🏠 Всички обекти</option>
          {propertyNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12" style={{ color: "#247ba0" }}>
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-sm">Няма обходи за този обект</div>
          </div>
        )}
        {filtered.map((job) => {
          const st = STATUS_MAP[job.status];
          return (
            <button
              key={job.id}
              onClick={() => setDetailedJob(job)}
              className="w-full p-4 rounded-xl bg-white border text-left transition hover:shadow-md"
              style={{ borderColor: "#e4e9f0" }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{ background: st.bg, color: st.color }}
                >
                  {st.label}
                </span>
                <span
                  className="text-sm font-semibold truncate flex-1"
                  style={{ color: "#006494" }}
                >
                  {job.propertyName}
                </span>
              </div>
              <div className="text-xs space-y-0.5" style={{ color: "#247ba0" }}>
                <div>
                  📅 {formatDate(job.date)} · 👷 {job.worker}
                </div>
                <div>
                  ✅ {job.itemsChecked}/{job.itemsTotal} точки · 📷 {job.photoCount}{" "}
                  снимки
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail modal */}
      {detailedJob && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.3)" }}
            onClick={() => setDetailedJob(null)}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl flex flex-col"
            style={{
              background: "#fff",
              maxHeight: "85dvh",
              boxShadow: "0 -4px 24px rgba(0,0,0,0.12)",
            }}
          >
            <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
              <div
                className="w-10 h-1 rounded-full"
                style={{ background: "#d8dee6" }}
              />
            </div>

            <div className="px-4 py-3 border-b flex-shrink-0" style={{ borderColor: "#e4e9f0" }}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold" style={{ color: "#006494" }}>
                    {detailedJob.propertyName}
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: "#247ba0" }}>
                    {formatDate(detailedJob.date)}
                  </p>
                </div>
                <button
                  onClick={() => setDetailedJob(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "#f1f5f9", color: "#64748b", fontSize: 15 }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {/* Status */}
              <div className="flex items-center gap-3">
                <span
                  className="px-3 py-1 rounded-full text-sm font-bold"
                  style={{
                    background: STATUS_MAP[detailedJob.status].bg,
                    color: STATUS_MAP[detailedJob.status].color,
                  }}
                >
                  {STATUS_MAP[detailedJob.status].label}
                </span>
                <span className="text-sm" style={{ color: "#247ba0" }}>
                  👷 {detailedJob.worker}
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl text-center" style={{ background: "#e8f1f2" }}>
                  <div className="text-2xl font-bold" style={{ color: "#1b98e0" }}>
                    {detailedJob.itemsChecked}/{detailedJob.itemsTotal}
                  </div>
                  <div className="text-xs mt-1" style={{ color: "#247ba0" }}>
                    Точки
                  </div>
                </div>
                <div className="p-3 rounded-xl text-center" style={{ background: "#e8f1f2" }}>
                  <div className="text-2xl font-bold" style={{ color: "#a663cc" }}>
                    {detailedJob.photoCount}
                  </div>
                  <div className="text-xs mt-1" style={{ color: "#247ba0" }}>
                    Снимки
                  </div>
                </div>
                <div className="p-3 rounded-xl text-center" style={{ background: "#e8f1f2" }}>
                  <div className="text-2xl font-bold" style={{ color: "#006494" }}>
                    {Math.round((detailedJob.itemsChecked / detailedJob.itemsTotal) * 100)}%
                  </div>
                  <div className="text-xs mt-1" style={{ color: "#247ba0" }}>
                    Покритие
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "#64748b" }}>
                  📝 Бележки
                </div>
                <div
                  className="p-3 rounded-xl text-sm leading-relaxed"
                  style={{ background: "#f8fafc", color: "#334155" }}
                >
                  {detailedJob.notes || "Няма допълнителни бележки."}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
