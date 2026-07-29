"use client";

import Topbar from "@/components/Topbar";
import MapView from "@/components/MapView";
import { useState } from "react";

const TABS = [
  { id: "map", label: "🗺️ Карта" },
  { id: "tasks", label: "📋 Задачи" },
  { id: "fixes", label: "🔧 Ремонти" },
  { id: "props", label: "🏠 Обекти" },
  { id: "history", label: "📊 История" },
];

export default function DashboardPage() {
  const [tab, setTab] = useState("map");

  return (
    <div className="flex flex-col h-[100dvh]" style={{ backgroundColor: "#e8f1f2" }}>
      <Topbar />

      {/* Tabs */}
      <div
        className="flex gap-0 border-b flex-shrink-0 overflow-x-auto px-2"
        style={{ background: "rgba(255,255,255,0.7)", backdropFilter: "blur(14px)", borderColor: "#e4e9f0" }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition"
            style={{
              fontSize: 14,
              color: tab === t.id ? "#1b98e0" : "#247ba0",
              borderColor: tab === t.id ? "#1b98e0" : "transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {tab === "map" && <MapView />}

        {tab !== "map" && (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <div className="text-4xl mb-4">
                {tab === "tasks" ? "📋" : tab === "fixes" ? "🔧" : tab === "props" ? "🏠" : "📊"}
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: "#006494" }}>
                {tab === "tasks" ? "Задачи" : tab === "fixes" ? "Ремонти" : tab === "props" ? "Обекти" : "История"}
              </h3>
              <p className="text-sm max-w-xs leading-relaxed" style={{ color: "#247ba0" }}>
                {tab === "tasks" && "Списък с активни обходи и задачи за изпълнение."}
                {tab === "fixes" && "Проследяване на ремонти — от констатация до приключване."}
                {tab === "props" && "Всички имоти под наблюдение с детайли и история."}
                {tab === "history" && "Архив на обходи, доклади и намерени проблеми."}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
