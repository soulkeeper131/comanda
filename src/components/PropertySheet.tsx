"use client";

import { useState } from "react";
import { MOCK_PROPERTIES, MOCK_TEMPLATES, type MockProperty, type MockTemplate } from "@/lib/mock-data";
import TrustScore, { type TrustScoreDetail } from "@/components/TrustScore";

function daysAgo(ts: string) {
  const d = Math.round((Date.now() - new Date(ts).getTime()) / 86400000);
  if (d === 0) return "днес";
  if (d === 1) return "вчера";
  return `преди ${d} дни`;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = (hash << 5) - hash + c;
    hash |= 0;
  }
  return Math.abs(hash);
}

function generateTrustScore(id: string): { score: number; maxScore: number; details: TrustScoreDetail[] } {
  const h = hashString(id);
  const s1 = ((h * 7) % 100) / 100;
  const s2 = ((h * 13) % 100) / 100;
  const s3 = ((h * 17) % 100) / 100;
  const s4 = ((h * 23) % 100) / 100;

  const details: TrustScoreDetail[] = [
    { label: "Редовност на обходи", value: Math.round(6 + s1 * 6), max: 12 },
    { label: "Снимкови отчети", value: Math.round(5 + s2 * 7), max: 12 },
    { label: "GPS потвърждение", value: Math.round(7 + s3 * 5), max: 12 },
    { label: "Без констатации", value: Math.round(1 + s4 * 2), max: 3 },
  ];

  const avgRatio = details.map((d) => d.value / d.max).reduce((a, b) => a + b, 0) / details.length;
  const score = Math.round(avgRatio * 100);
  return { score, maxScore: 100, details };
}

export default function PropertySheet({ property, onClose }: { property: MockProperty; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: "90dvh", paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-1" style={{ background: "#D8DEE6" }} />
        <div className="px-5 py-3 border-b flex items-center gap-3" style={{ borderColor: "#e4e9f0" }}>
          <h3 className="text-lg font-bold" style={{ color: "#006494" }}>
            {property.name}
          </h3>
          <span
            className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{
              color: property.status === "ok" ? "#16a34a" : property.status === "soon" ? "#d97706" : "#dc2626",
              background: property.status === "ok" ? "#dcfce7" : property.status === "soon" ? "#fef3c7" : "#fee2e2",
            }}
          >
            {property.status === "ok" ? "✓ Активен" : property.status === "soon" ? "⏳ Предстои" : "⚠ Просрочен"}
          </span>
          <button onClick={onClose} className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full flex items-center justify-center text-base" style={{ background: "#e4e9f0", color: "#247ba0" }}>
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4" style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}>
          {/* Address & Access */}
          <div className="text-sm mb-4" style={{ color: "#247ba0" }}>
            <strong style={{ color: "#006494" }}>Адрес:</strong> {property.addr}
          </div>
          <div className="text-sm mb-4" style={{ color: "#247ba0" }}>
            <strong style={{ color: "#006494" }}>Тип:</strong>{" "}
            {property.type === "apartment" ? "Апартамент" : property.type === "house" ? "Къща" : property.type === "studio" ? "Студио" : "Вила"}
          </div>
          <div className="text-sm mb-4" style={{ color: "#247ba0" }}>
            <strong style={{ color: "#006494" }}>Последен обход:</strong> {daysAgo(property.lastVisit)}
          </div>

          {/* Access */}
          <div className="p-3 rounded-xl mb-3 text-sm" style={{ background: "#f0f7ff", color: "#247ba0", border: "1px solid #d0e5ff" }}>
            <strong style={{ color: "#006494" }}>🔑 Достъп:</strong> {property.access}
          </div>
          <div className="p-3 rounded-xl mb-4 text-sm" style={{ background: "#f0f7ff", color: "#247ba0", border: "1px solid #d0e5ff" }}>
            <strong style={{ color: "#006494" }}>🔧 Комуникации:</strong> {property.utils}
          </div>

          {/* Trust Score */}
          <TrustScore {...generateTrustScore(property.id)} />

          {/* Zones */}
          <h4 className="text-sm font-bold mb-2" style={{ color: "#006494" }}>
            📋 Зони за проверка ({property.zones.length})
          </h4>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {property.zones.map((z) => (
              <span key={z} className="px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ background: "#e8f1f2", color: "#006494" }}>
                {z}
              </span>
            ))}
          </div>

          {/* Quick actions */}
          <div className="flex gap-2">
            <button className="flex-1 min-h-[44px] py-3 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(140deg, #1b98e0, #006494)" }}>
              📋 Нов обход
            </button>
            <button className="flex-1 min-h-[44px] py-3 rounded-xl text-sm font-semibold border" style={{ borderColor: "#d0e5ff", color: "#006494" }}>
              🔧 Докладвай проблем
            </button>
            <button
              onClick={() => window.open(`/api/reports/property/${property.id}`, "_blank")}
              className="flex-1 min-h-[44px] py-3 rounded-xl text-sm font-semibold border"
              style={{ borderColor: "#d0e5ff", color: "#1b98e0", background: "#eff6ff" }}
            >
              📄 Отчет за имот
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
