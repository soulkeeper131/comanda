"use client";

import { useState, useEffect, useCallback } from "react";

type OfferFromApi = {
  id: string;
  finding_id: string;
  price: number | null;
  days: number | null;
  scope: string | null;
  sent_at: string;
  decision: string;
  finding: {
    id: string;
    title: string;
    body: string | null;
    type: string;
    property_id: string;
    property_name: string;
    created_at: string;
  } | null;
};

type Props = {
  findingId?: string;
  decisionFilter?: string;
  onPay?: (offerId: string) => void;
};

const TYPE_COLORS: Record<string, string> = {
  "Теч": "#dc2626",
  "Мухъл/влага": "#a663cc",
  "Повреда": "#d97706",
  "Липса": "#0891b2",
  "Друго": "#64748b",
};

const DECISION_CONFIG: Record<string, { label: string; bg: string; color: string; emoji: string; sectionLabel: string }> = {
  pending: { label: "Чакаща", bg: "#fef3c7", color: "#d97706", emoji: "⏳", sectionLabel: "⏳ За решение" },
  accepted: { label: "Приета", bg: "#dcfce7", color: "#16a34a", emoji: "✅", sectionLabel: "✅ Приети" },
  declined: { label: "Отказана", bg: "#fee2e2", color: "#dc2626", emoji: "❌", sectionLabel: "❌ Отказани" },
  paid: { label: "Платена", bg: "#dbeafe", color: "#1b98e0", emoji: "💳", sectionLabel: "💳 Платени" },
  in_progress: { label: "В процес", bg: "#ede9fe", color: "#a663cc", emoji: "🔧", sectionLabel: "🔧 В процес" },
  done: { label: "Завършена", bg: "#dcfce7", color: "#15803d", emoji: "🏁", sectionLabel: "🏁 Завършени" },
};

export default function OffersPanel({ findingId, decisionFilter, onPay }: Props) {
  const [offers, setOffers] = useState<OfferFromApi[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOffers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (findingId) params.set("finding_id", findingId);
      if (decisionFilter && decisionFilter !== "all") params.set("decision", decisionFilter);
      const qs = params.toString();
      const url = qs ? `/api/offers?${qs}` : "/api/offers";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setOffers(data);
      }
    } catch (e) {
      console.error("Offers load error:", e);
    } finally {
      setLoading(false);
    }
  }, [findingId, decisionFilter]);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  const updateDecision = async (offerId: string, decision: string) => {
    try {
      const res = await fetch(`/api/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (res.ok) {
        setOffers((prev) =>
          prev.map((o) =>
            o.id === offerId ? { ...o, decision } : o
          )
        );
      }
    } catch (e) {
      console.error("Update offer error:", e);
    }
  };

  const handleAccept = (offerId: string) => updateDecision(offerId, "accepted");
  const handleDecline = (offerId: string) => updateDecision(offerId, "declined");

  // Group offers by decision category
  const sections: { key: string; items: OfferFromApi[] }[] = [
    { key: "paid", items: offers.filter((o) => o.decision === "paid") },
    { key: "in_progress", items: offers.filter((o) => o.decision === "in_progress") },
    { key: "done", items: offers.filter((o) => o.decision === "done") },
    { key: "accepted", items: offers.filter((o) => o.decision === "accepted") },
    { key: "pending", items: offers.filter((o) => o.decision === "pending") },
    { key: "declined", items: offers.filter((o) => o.decision === "declined") },
  ].filter((s) => s.items.length > 0);

  const renderOfferCard = (offer: OfferFromApi) => {
    const f = offer.finding;
    const type = f?.type || "Друго";
    const config = DECISION_CONFIG[offer.decision] || DECISION_CONFIG.pending;

    return (
      <div
        key={offer.id}
        className="p-4 rounded-xl border bg-white mb-3"
        style={{
          borderColor: `${config.color}40`,
        }}
      >
        {/* Header with type badge */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-md"
            style={{
              background: `${TYPE_COLORS[type] || "#64748b"}18`,
              color: TYPE_COLORS[type] || "#64748b",
            }}
          >
            {type}
          </span>
          <span
            className="text-xs"
            style={{ color: "#247ba0" }}
          >
            {f?.property_name || "Имот"}
          </span>
          <span
            className="ml-auto text-xs font-bold px-2 py-0.5 rounded-md"
            style={{ background: config.bg, color: config.color }}
          >
            {config.emoji} {config.label}
          </span>
        </div>

        {/* Title */}
        <h4
          className="text-sm font-bold mb-1"
          style={{ color: "#006494" }}
        >
          {f?.title || "Без заглавие"}
        </h4>
        <p
          className="text-xs mb-3 leading-relaxed"
          style={{ color: "#64748b" }}
        >
          {f?.body || ""}
        </p>

        {/* Offer details */}
        <div
          className="p-3 rounded-lg mb-3"
          style={{ background: "#f8fafc" }}
        >
          <div
            className="text-xs font-semibold mb-1"
            style={{ color: "#247ba0" }}
          >
            📋 Оферта
          </div>
          <p
            className="text-xs mb-2 leading-relaxed"
            style={{ color: "#475569" }}
          >
            {offer.scope || ""}
          </p>
          <div className="flex items-center gap-4">
            <span
              className="text-sm font-bold"
              style={{ color: "#006494" }}
            >
              {offer.price ? offer.price.toFixed(0) : "0"} лв
            </span>
            <span
              className="text-xs"
              style={{ color: "#64748b" }}
            >
              ⏱ {offer.days || 0} {offer.days === 1 ? "ден" : "дни"}
            </span>
          </div>
        </div>

        {/* Action buttons — pending: accept/decline */}
        {offer.decision === "pending" && (
          <div className="flex gap-2">
            <button
              onClick={() => handleAccept(offer.id)}
              className="flex-1 min-h-[44px] py-2.5 rounded-lg text-xs font-semibold text-white"
              style={{
                background: "linear-gradient(140deg, #16a34a, #15803d)",
              }}
            >
              ✅ Приеми
            </button>
            <button
              onClick={() => handleDecline(offer.id)}
              className="flex-1 min-h-[44px] py-2.5 rounded-lg text-xs font-semibold border"
              style={{
                borderColor: "#fecaca",
                color: "#dc2626",
              }}
            >
              ❌ Откажи
            </button>
          </div>
        )}

        {/* Action buttons — accepted: pay */}
        {offer.decision === "accepted" && (
          <button
            onClick={() => onPay?.(offer.id)}
            className="w-full min-h-[44px] py-2.5 rounded-lg text-xs font-semibold text-white"
            style={{
              background: "linear-gradient(140deg, #1b98e0, #006494)",
            }}
          >
            💳 Плати сега ({offer.price ? offer.price.toFixed(0) : "0"} лв)
          </button>
        )}

        {/* Action buttons — paid: mark in progress (admin only in dashboard) */}
        {offer.decision === "paid" && (
          <div className="text-xs text-center py-1" style={{ color: "#247ba0" }}>
            💳 Плащането е получено — очаква изпълнение
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-4 flex items-center justify-center">
        <div className="text-lg" style={{ color: "#247ba0" }}>Зареждане...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {/* Grouped sections */}
      {sections.map((section) => (
        <div key={section.key} className="mb-4">
          <div
            className="text-xs font-bold uppercase tracking-wide mb-2"
            style={{ color: DECISION_CONFIG[section.key]?.color || "#247ba0" }}
          >
            {DECISION_CONFIG[section.key]?.sectionLabel || section.key} ({section.items.length})
          </div>
          {section.items.map(renderOfferCard)}
        </div>
      ))}

      {/* Empty state */}
      {offers.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center py-16">
          <div className="text-5xl mb-4">📋</div>
          <h3
            className="text-lg font-bold mb-2"
            style={{ color: "#006494" }}
          >
            Няма данни
          </h3>
          <p className="text-sm max-w-xs" style={{ color: "#247ba0" }}>
            Когато докладваш проблем, тук ще се появят оферти за ремонт от
            изпълнителите.
          </p>
        </div>
      )}
    </div>
  );
}
