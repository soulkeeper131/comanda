"use client";

import { useState } from "react";

const PLANS = [
  { key: "year", icon: "🔄", name: "Пълен надзор", price: "60€/мес", desc: "12 месеца грижа, чек-листът следва сезона" },
  { key: "winter", icon: "❄️", name: "Зимен сезон", price: "40€/мес", desc: "Октомври – Април, защита от влага и студ" },
  { key: "summer", icon: "☀️", name: "Летен сезон", price: "50€/мес", desc: "Май – Септември, проверки след бури и жега" },
];

export default function PlanSelector({ propertyId, onDone }: { propertyId: string; onDone: () => void }) {
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSelect = async (planType: string) => {
    setSelected(planType);
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/properties/${propertyId}/plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_type: planType }),
      });
      if (res.ok) {
        onDone();
      } else {
        const d = await res.json();
        setError(d.error || "Грешка");
      }
    } catch {
      setError("Грешка при запазване");
    }
    setLoading(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onDone} />
      <div className="fixed inset-x-4 bottom-1/2 translate-y-1/2 z-50 max-w-md mx-auto bg-white rounded-2xl shadow-2xl p-6">
        <h3 className="text-lg font-bold mb-2" style={{ color: "#006494" }}>
          🎯 Избери пакет за обекта
        </h3>
        <p className="text-sm mb-4" style={{ color: "#64748b" }}>
          Всеки обект има нужда от план за обслужване. Можеш да го смениш по-късно.
        </p>

        {error && (
          <div className="mb-3 p-2 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>
        )}

        <div className="space-y-2">
          {PLANS.map((p) => (
            <button
              key={p.key}
              disabled={loading}
              onClick={() => handleSelect(p.key)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border text-left transition disabled:opacity-50"
              style={{
                borderColor: selected === p.key ? "#1b98e0" : "#e4e9f0",
                background: selected === p.key ? "#f0f9ff" : "#fff",
              }}
            >
              <span className="text-2xl">{p.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm" style={{ color: "#006494" }}>{p.name}</div>
                <div className="text-xs" style={{ color: "#64748b" }}>{p.desc}</div>
              </div>
              <span className="font-bold text-sm shrink-0" style={{ color: "#1b98e0" }}>{p.price}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onDone}
          className="w-full mt-3 py-2 text-sm font-medium rounded-xl border transition"
          style={{ color: "#64748b", borderColor: "#e4e9f0" }}
        >
          Пропусни за сега
        </button>
      </div>
    </>
  );
}
