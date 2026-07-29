"use client";

import { MOCK_PROPERTIES, MOCK_TEMPLATES, type MockProperty } from "@/lib/mock-data";

export default function MapView({ onPropertyClick }: { onPropertyClick: (p: MockProperty) => void }) {
  const statusColors: Record<string, string> = {
    ok: "#16a34a",
    soon: "#d97706",
    overdue: "#dc2626",
  };

  return (
    <div className="h-full w-full flex items-center justify-center bg-white">
      <div className="text-center p-4" style={{ maxWidth: 480 }}>
        <div className="text-5xl mb-4">🗺️</div>
        <h3 className="text-lg font-bold mb-2" style={{ color: "#006494" }}>
          Карта на обектите
        </h3>
        <p className="text-sm mb-6 leading-relaxed" style={{ color: "#247ba0" }}>
          5 имота в София под наблюдение. Всеки маркер показва статус на последния обход.
        </p>

        {/* Property quick cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
          {MOCK_PROPERTIES.map((p) => (
            <button
              key={p.id}
              onClick={() => onPropertyClick(p)}
              className="flex items-center gap-3 p-3 rounded-xl border transition hover:shadow-md bg-white text-left"
              style={{ borderColor: "#e4e9f0" }}
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: statusColors[p.status] }}
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: "#006494" }}>
                  {p.name}
                </div>
                <div className="text-xs truncate" style={{ color: "#247ba0" }}>
                  {p.addr.split(",")[0]}
                </div>
              </div>
              <div className="ml-auto text-xs font-semibold flex-shrink-0" style={{ color: statusColors[p.status] }}>
                {p.status === "ok" ? "✓" : p.status === "soon" ? "⏳" : "⚠"}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
