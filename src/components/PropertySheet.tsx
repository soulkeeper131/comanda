"use client";

import { useState } from "react";
import { MOCK_PROPERTIES, MOCK_TEMPLATES, type MockProperty, type MockTemplate } from "@/lib/mock-data";

function daysAgo(ts: string) {
  const d = Math.round((Date.now() - new Date(ts).getTime()) / 86400000);
  if (d === 0) return "днес";
  if (d === 1) return "вчера";
  return `преди ${d} дни`;
}

export default function PropertySheet({ property, onClose }: { property: MockProperty; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: "90dvh" }}
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
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-base" style={{ background: "#e4e9f0", color: "#247ba0" }}>
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
            <button className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(140deg, #1b98e0, #006494)" }}>
              📋 Нов обход
            </button>
            <button className="flex-1 py-3 rounded-xl text-sm font-semibold border" style={{ borderColor: "#d0e5ff", color: "#006494" }}>
              🔧 Докладвай проблем
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
