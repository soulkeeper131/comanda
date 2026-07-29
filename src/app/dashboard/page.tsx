"use client";

import { useState } from "react";
import Topbar from "@/components/Topbar";
import MapView from "@/components/MapView";
import PropertySheet from "@/components/PropertySheet";
import PropertyForm from "@/components/PropertyForm";
import { MOCK_PROPERTIES, MOCK_TEMPLATES, type MockProperty } from "@/lib/mock-data";

const TABS = [
  { id: "map", label: "🗺️ Карта" },
  { id: "tasks", label: "📋 Задачи" },
  { id: "fixes", label: "🔧 Ремонти" },
  { id: "props", label: "🏠 Обекти" },
  { id: "history", label: "📊 История" },
];

function daysAgo(ts: string) {
  const d = Math.round((Date.now() - new Date(ts).getTime()) / 86400000);
  if (d === 0) return "днес";
  if (d === 1) return "вчера";
  return `преди ${d} дни`;
}

export default function DashboardPage() {
  const [tab, setTab] = useState("map");
  const [selectedProperty, setSelectedProperty] = useState<MockProperty | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [properties, setProperties] = useState(MOCK_PROPERTIES);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");

  const filtered = properties.filter(
    (p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.addr.toLowerCase().includes(search.toLowerCase())
  );

  const statusDot = (s: string) => {
    const colors: Record<string, string> = { ok: "#16a34a", soon: "#d97706", overdue: "#dc2626" };
    return <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colors[s] || "#999" }} />;
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  };

  return (
    <div className="flex flex-col h-[100dvh]" style={{ backgroundColor: "#e8f1f2" }}>
      <Topbar />

      {/* Tabs */}
      <div className="flex gap-0 border-b flex-shrink-0 overflow-x-auto px-2"
        style={{ background: "rgba(255,255,255,0.7)", backdropFilter: "blur(14px)", borderColor: "#e4e9f0" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition"
            style={{ fontSize: 14, color: tab === t.id ? "#1b98e0" : "#247ba0", borderColor: tab === t.id ? "#1b98e0" : "transparent" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {tab === "map" && (
          <MapView
            properties={properties.map((p) => ({
              id: p.id,
              name: p.name,
              address: p.addr,
              lat: p.lat,
              lng: p.lng,
              status: p.status as "ok" | "warn" | "bad",
              kind: p.kind,
              zones: p.zones,
              accessNotes: p.access,
              lastVisit: p.lastVisit,
              plan: p.plan,
            }))}
            onPropertyClick={(p) => setSelectedProperty(p as any)}
          />
        )}

        {tab === "props" && (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <input type="text" placeholder="🔍 Търси обект..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border text-base mb-3"
              style={{ borderColor: "#e4e9f0", fontSize: 16, color: "#006494" }} />
            <div className="space-y-2">
              {filtered.map((p) => (
                <button key={p.id} onClick={() => setSelectedProperty(p)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border bg-white text-left transition hover:shadow-md"
                  style={{ borderColor: "#e4e9f0" }}>
                  {statusDot(p.status)}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate" style={{ color: "#006494" }}>{p.name}</div>
                    <div className="text-xs truncate" style={{ color: "#247ba0" }}>{p.addr.split(",")[0]}</div>
                  </div>
                  <div className="text-xs text-right flex-shrink-0" style={{ color: "#247ba0" }}>
                    <div>{p.zones.length} зони</div>
                    <div>{daysAgo(p.lastVisit)}</div>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-12" style={{ color: "#247ba0" }}>
                  <div className="text-4xl mb-3">🔍</div>
                  <div className="text-sm">Няма намерени обекти</div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "tasks" && (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-2">
              {MOCK_TEMPLATES.map((tpl) => (
                <div key={tpl.id} className="p-4 rounded-xl bg-white border" style={{ borderColor: "#e4e9f0" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{tpl.icon}</span>
                    <span className="text-sm font-bold" style={{ color: "#006494" }}>{tpl.name}</span>
                    <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: "#e8f1f2", color: "#247ba0" }}>
                      {tpl.mins} мин
                    </span>
                  </div>
                  <div className="text-xs mb-3" style={{ color: "#247ba0" }}>
                    {tpl.items.length} точки в чек-листа
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 py-2 rounded-lg text-xs font-semibold text-white"
                      style={{ background: "linear-gradient(140deg, #1b98e0, #006494)" }}>
                      ▶ Започни обход
                    </button>
                    <button className="px-4 py-2 rounded-lg text-xs font-semibold border" style={{ borderColor: "#d0e5ff", color: "#006494" }}>
                      👁 Преглед
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "fixes" && (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <div className="text-4xl mb-4">🔧</div>
              <h3 className="text-lg font-bold mb-2" style={{ color: "#006494" }}>Ремонти</h3>
              <p className="text-sm" style={{ color: "#247ba0" }}>Проследяване на ремонти — от констатация до приключване.</p>
            </div>
          </div>
        )}

        {tab === "history" && (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-2">
              {properties.slice(0, 3).map((p) => (
                <div key={p.id} className="p-4 rounded-xl bg-white border" style={{ borderColor: "#e4e9f0" }}>
                  <div className="flex items-center gap-2 mb-1">
                    {statusDot(p.status)}
                    <span className="text-sm font-semibold" style={{ color: "#006494" }}>{p.name}</span>
                  </div>
                  <div className="text-xs" style={{ color: "#247ba0" }}>
                    Последен обход: {daysAgo(p.lastVisit)} · {p.zones.length} зони проверени
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FAB */}
        <button
          onClick={() => setShowAddForm(true)}
          className="absolute bottom-6 right-6 w-14 h-14 rounded-2xl text-white text-2xl flex items-center justify-center shadow-lg transition hover:scale-105 z-30"
          style={{ background: "linear-gradient(140deg, #1b98e0, #006494)", boxShadow: "0 6px 20px rgba(0,100,148,0.4)" }}
        >
          ＋
        </button>
      </main>

      {/* Modals */}
      {selectedProperty && <PropertySheet property={selectedProperty} onClose={() => setSelectedProperty(null)} />}
      {showAddForm && (
        <PropertyForm
          onAdd={(data) => {
            const newProp: MockProperty = {
              ...data,
              id: "p" + Date.now(),
              lat: 42.69 + Math.random() * 0.02,
              lng: 23.31 + Math.random() * 0.04,
              owner: "u_own1",
              radius: 75,
              vacantSince: new Date().toISOString(),
              utils: "",
              zones: ["Антре", "Дневна", "Баня"],
              lastVisit: new Date().toISOString(),
              status: "ok",
            };
            setProperties([newProp, ...properties]);
            showToast("✅ Обектът е добавен");
          }}
          onClose={() => setShowAddForm(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full text-white text-sm font-semibold shadow-lg"
          style={{ background: "#006494" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
