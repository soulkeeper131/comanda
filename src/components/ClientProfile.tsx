"use client";

import { useState, useEffect } from "react";

interface ClientProfileProps {
  userId?: string;
}

export default function ClientProfile({ userId }: ClientProfileProps) {
  const [profile, setProfile] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState<"profile" | "plans" | "payments" | "invoices">("profile");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeSection === "plans") {
      fetch("/api/me/plans")
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setPlans(Array.isArray(data) ? data : []))
        .catch(() => setPlans([]));
    }
    if (activeSection === "payments") {
      fetch("/api/payments")
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setPayments(Array.isArray(data) ? data : []))
        .catch(() => setPayments([]));
    }
    if (activeSection === "invoices") {
      fetch("/api/invoices")
        .then((r) => r.ok ? r.json() : [])
        .then((data) => setInvoices(Array.isArray(data) ? data : []))
        .catch(() => setInvoices([]));
    }
  }, [activeSection]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-lg" style={{ color: "#247ba0" }}>Зареждане...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {/* Section tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {[
          { key: "profile", label: "👤 Профил" },
          { key: "plans", label: "📦 Пакети" },
          { key: "payments", label: "💰 Плащания" },
          { key: "invoices", label: "📄 Фактури" },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key as any)}
            className="px-3 min-h-[36px] py-1.5 text-xs font-semibold rounded-full transition whitespace-nowrap"
            style={{
              fontSize: 13,
              background: activeSection === s.key ? "#1b98e0" : "transparent",
              color: activeSection === s.key ? "#fff" : "#247ba0",
              border: activeSection === s.key ? "none" : "1px solid #e4e9f0",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Profile section */}
      {activeSection === "profile" && profile && (
        <div className="space-y-4">
          <div className="p-5 rounded-xl border bg-white" style={{ borderColor: "#e4e9f0" }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: "#006494" }}>Лична информация</h3>
            <div className="space-y-3">
              <div>
                <span className="text-xs font-semibold block mb-1" style={{ color: "#247ba0" }}>Име</span>
                <span className="text-sm font-semibold" style={{ color: "#006494" }}>{profile.name || "—"}</span>
              </div>
              <div>
                <span className="text-xs font-semibold block mb-1" style={{ color: "#247ba0" }}>Имейл</span>
                <span className="text-sm font-semibold" style={{ color: "#006494" }}>{profile.email || "—"}</span>
              </div>
              <div>
                <span className="text-xs font-semibold block mb-1" style={{ color: "#247ba0" }}>Телефон</span>
                <span className="text-sm font-semibold" style={{ color: "#006494" }}>{profile.phone || "—"}</span>
              </div>
              {profile.company_name && (
                <>
                  <div className="border-t pt-3" style={{ borderColor: "#e4e9f0" }}>
                    <span className="text-xs font-semibold block mb-1" style={{ color: "#247ba0" }}>Фирма</span>
                    <span className="text-sm font-semibold" style={{ color: "#006494" }}>{profile.company_name}</span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold block mb-1" style={{ color: "#247ba0" }}>ЕИК</span>
                    <span className="text-sm font-semibold" style={{ color: "#006494" }}>{profile.eik || "—"}</span>
                  </div>
                  {profile.vat_number && (
                    <div>
                      <span className="text-xs font-semibold block mb-1" style={{ color: "#247ba0" }}>ДДС номер</span>
                      <span className="text-sm font-semibold" style={{ color: "#006494" }}>{profile.vat_number}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Plans section */}
      {activeSection === "plans" && (
        <div className="space-y-2">
          {plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16">
              <div className="text-5xl mb-4">📦</div>
              <h3 className="text-lg font-bold mb-2" style={{ color: "#006494" }}>Няма активни пакети</h3>
              <p className="text-sm max-w-xs" style={{ color: "#247ba0" }}>
                Добави обект и избраният пакет ще се покаже тук.
              </p>
            </div>
          ) : (
            plans.map((p: any) => (
              <div
                key={p.id}
                className="p-4 rounded-xl border bg-white"
                style={{ borderColor: "#e4e9f0" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-bold" style={{ color: "#006494" }}>{p.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: "#247ba0" }}>
                      {p.property_name || "Обект"}
                    </div>
                  </div>
                  <span
                    className="text-xs font-bold px-2 py-1 rounded-md"
                    style={{
                      background: p.active ? "#dcfce7" : "#f1f5f9",
                      color: p.active ? "#16a34a" : "#94a3b8",
                    }}
                  >
                    {p.active ? "✓ Активен" : "⏸ Неактивен"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs" style={{ color: "#64748b" }}>
                  <span>{p.price}€ / месец</span>
                  <span>{p.per_month} обхода месечно</span>
                  {p.started_at && (
                    <span>От: {new Date(p.started_at).toLocaleDateString("bg-BG")}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Payments section */}
      {activeSection === "payments" && (
        <div className="space-y-2">
          {payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16">
              <div className="text-5xl mb-4">💰</div>
              <h3 className="text-lg font-bold mb-2" style={{ color: "#006494" }}>Няма плащания</h3>
              <p className="text-sm max-w-xs" style={{ color: "#247ba0" }}>
                Тук ще виждаш историята на плащанията си.
              </p>
            </div>
          ) : (
            payments.map((p: any) => (
              <div
                key={p.id}
                className="flex items-center gap-3 p-4 rounded-xl border bg-white"
                style={{ borderColor: "#e4e9f0" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold" style={{ color: "#006494" }}>{p.description || "Плащане"}</div>
                  <div className="text-xs mt-0.5" style={{ color: "#247ba0" }}>
                    {p.created_at ? new Date(p.created_at).toLocaleDateString("bg-BG") : ""}
                    {p.payment_method && ` · ${p.payment_method === "card" ? "💳 Карта" : "🏦 Банков превод"}`}
                  </div>
                </div>
                <span className="text-sm font-bold flex-shrink-0" style={{ color: p.status === "paid" ? "#16a34a" : "#d97706" }}>
                  {p.amount?.toFixed(2)} лв
                </span>
                <span
                  className="text-xs font-bold px-2 py-1 rounded-md flex-shrink-0"
                  style={{
                    background: p.status === "paid" ? "#dcfce7" : "#fef3c7",
                    color: p.status === "paid" ? "#16a34a" : "#d97706",
                  }}
                >
                  {p.status === "paid" ? "✓ Платено" : "⏳ Чака"}
                </span>
                {p.status === "paid" && (
                  <a
                    href={`/api/invoices?payment_id=${p.id}&download=1`}
                    className="text-xs font-semibold px-2 py-1.5 rounded-lg border flex-shrink-0 transition hover:bg-gray-50"
                    style={{ borderColor: "#e4e9f0", color: "#1b98e0", minHeight: "32px" }}
                  >
                    📥 Свали
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Invoices section */}
      {activeSection === "invoices" && (
        <div className="space-y-2">
          {invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16">
              <div className="text-5xl mb-4">📄</div>
              <h3 className="text-lg font-bold mb-2" style={{ color: "#006494" }}>Няма фактури</h3>
              <p className="text-sm max-w-xs" style={{ color: "#247ba0" }}>
                Фактурите се генерират автоматично след плащане.
              </p>
            </div>
          ) : (
            invoices.map((inv: any) => (
              <div
                key={inv.id}
                className="flex items-center gap-3 p-4 rounded-xl border bg-white"
                style={{ borderColor: "#e4e9f0" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold" style={{ color: "#006494" }}>Фактура №{inv.number}</div>
                  <div className="text-xs mt-0.5" style={{ color: "#247ba0" }}>
                    {inv.created_at ? new Date(inv.created_at).toLocaleDateString("bg-BG") : ""}
                  </div>
                </div>
                <span className="text-sm font-bold flex-shrink-0" style={{ color: "#1b98e0" }}>
                  {inv.amount?.toFixed(2)} лв
                </span>
                <a
                  href={`/api/invoices?invoice_id=${inv.id}&download=1`}
                  className="text-xs font-semibold px-2 py-1.5 rounded-lg border flex-shrink-0 transition hover:bg-gray-50"
                  style={{ borderColor: "#e4e9f0", color: "#1b98e0", minHeight: "32px" }}
                >
                  📥 Свали
                </a>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
