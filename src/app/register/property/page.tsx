"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const PLAN_NAMES: Record<string, { icon: string; name: string; price: string }> = {
  year: { icon: "🔄", name: "Пълен надзор", price: "60€/мес" },
  winter: { icon: "❄️", name: "Зимен сезон", price: "40€/мес" },
  summer: { icon: "☀️", name: "Летен сезон", price: "50€/мес" },
};

const PROPERTY_KINDS = [
  { value: "apartment", label: "🏢 Апартамент" },
  { value: "house", label: "🏠 Къща" },
  { value: "villa", label: "🏡 Вила" },
  { value: "office", label: "🏬 Офис" },
  { value: "other", label: "📌 Друго" },
];

function PropertyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") || "";
  const planInfo = PLAN_NAMES[plan] || null;

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [kind, setKind] = useState("apartment");
  const [accessNotes, setAccessNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Името на обекта е задължително");
      return;
    }
    if (!address.trim()) {
      setError("Адресът е задължителен");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim(),
          kind,
          access_notes: accessNotes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Грешка при създаване на обект");
      } else {
        // Redirect to onboarding — onboarding complete with role-specific walkthrough
        window.location.href = "/dashboard/onboarding";
      }
    } catch {
      setError("Възникна грешка. Опитай отново.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6" style={{ backgroundColor: "#e8f1f2" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <img
            src="/logo.png"
            alt="КОМАНДА"
            className="h-14 mx-auto mb-4"
          />
          <p className="text-sm" style={{ color: "#247ba0" }}>
            Стъпка 2 от 3 — Добави своя обект
          </p>
        </div>

        {/* Onboarding progress */}
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="flex-1 h-1.5 rounded-full" style={{ background: "#1b98e0" }} />
          <div className="flex-1 h-1.5 rounded-full" style={{ background: "#1b98e0" }} />
          <div className="flex-1 h-1.5 rounded-full bg-gray-200" />
        </div>

        <div className="mb-6 p-4 rounded-xl bg-white/80 border border-gray-100 text-sm" style={{ color: "#006494" }}>
          <p className="font-semibold mb-2">💡 Какво се случва?</p>
          <p>След като добавиш обекта си, ние ще знаем къде да ходим. Можеш да добавиш още обекти по-късно от таблото.</p>
          <p className="mt-2">Всеки обект получава свой график и история на обходите.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm font-medium">
              {error}
            </div>
          )}

          {/* Име на обект */}
          <div className="mb-5">
            <label className="block text-sm font-semibold mb-2" style={{ color: "#006494" }}>Име на обекта</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Напр. Апартамент София, Вила Боровец"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 transition"
              style={{ fontSize: "16px", minHeight: "44px" }}
            />
          </div>

          {/* Адрес */}
          <div className="mb-5">
            <label className="block text-sm font-semibold mb-2" style={{ color: "#006494" }}>Адрес</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="ул. Примерна №1, гр. София"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 transition"
              style={{ fontSize: "16px", minHeight: "44px" }}
            />
          </div>

          {/* Тип имот */}
          <div className="mb-5">
            <label className="block text-sm font-semibold mb-2" style={{ color: "#006494" }}>Тип на имота</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 transition appearance-none"
              style={{ fontSize: "16px", minHeight: "44px", color: "#006494" }}
            >
              {PROPERTY_KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </div>

          {/* Бележки за достъп */}
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2" style={{ color: "#006494" }}>
              Бележки за достъп <span className="font-normal text-gray-400">(по желание)</span>
            </label>
            <textarea
              value={accessNotes}
              onChange={(e) => setAccessNotes(e.target.value)}
              placeholder="Код на вход, етаж, инструкции..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 transition resize-none"
              style={{ fontSize: "16px" }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl text-white font-semibold text-base transition-all disabled:opacity-60"
            style={{
              background: "linear-gradient(140deg, #1b98e0, #006494)",
              boxShadow: "0 4px 14px rgba(0,100,148,0.25)",
              minHeight: "44px",
            }}
          >
            {loading ? "Запазване..." : "Добави обекта и продължи"}
          </button>
        </form>

        {/* Plan summary at bottom */}
        {planInfo && (
          <div className="mt-4 p-4 rounded-xl text-center" style={{ background: "rgba(27,152,224,0.08)" }}>
            <p className="text-sm" style={{ color: "#247ba0" }}>
              Избран пакет: <span className="font-semibold">{planInfo.icon} {planInfo.name} · {planInfo.price}</span>
            </p>
            <p className="text-xs mt-1" style={{ color: "#6b9eb3" }}>
              Ще го потвърдиш в следващата стъпка
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PropertyPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] flex items-center justify-center" style={{ backgroundColor: "#e8f1f2" }}><p>Зареждане...</p></div>}>
      <PropertyForm />
    </Suspense>
  );
}
