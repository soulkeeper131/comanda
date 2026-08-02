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
};

const TYPE_COLORS: Record<string, string> = {
  "Теч": "#dc2626",
  "Мухъл/влага": "#a663cc",
  "Повреда": "#d97706",
  "Липса": "#0891b2",
  "Друго": "#64748b",
};

export default function OffersPanel({ findingId, decisionFilter }: Props) {
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

  const handleAccept = async (offerId: string) => {
    try {
      const res = await fetch(`/api/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "accepted" }),
      });
      if (res.ok) {
        setOffers((prev) =>
          prev.map((o) =>
            o.id === offerId ? { ...o, decision: "accepted" } : o
          )
        );
      }
    } catch (e) {
      console.error("Accept offer error:", e);
    }
  };

  const handleDecline = async (offerId: string) => {
    try {
      const res = await fetch(`/api/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "declined" }),
      });
      if (res.ok) {
        setOffers((prev) =>
          prev.map((o) =>
            o.id === offerId ? { ...o, decision: "declined" } : o
          )
        );
      }
    } catch (e) {
      console.error("Decline offer error:", e);
    }
  };

  const pending = offers.filter((o) => o.decision === "pending");
  const accepted = offers.filter((o) => o.decision === "accepted");
  const declined = offers.filter((o) => o.decision === "declined");

  const renderOfferCard = (offer: OfferFromApi) => {
    const f = offer.finding;
    const isAccepted = offer.decision === "accepted";
    const isDeclined = offer.decision === "declined";
    const type = f?.type || "Друго";

    return (
      <div
        key={offer.id}
        className="p-4 rounded-xl border bg-white mb-3"
        style={{
          borderColor: isAccepted ? "#bbf7d0" : isDeclined ? "#fecaca" : "#e4e9f0",
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
          {isAccepted && (
            <span
              className="ml-auto text-xs font-bold px-2 py-0.5 rounded-md"
              style={{ background: "#dcfce7", color: "#16a34a" }}
            >
              ✓ Приета
            </span>
          )}
          {isDeclined && (
            <span
              className="ml-auto text-xs font-bold px-2 py-0.5 rounded-md"
              style={{ background: "#fee2e2", color: "#dc2626" }}
            >
              ✕ Отказана
            </span>
          )}
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

        {/* Action buttons - only for pending */}
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
      {/* Accepted offers */}
      {accepted.length > 0 && (
        <div className="mb-4">
          <div
            className="text-xs font-bold uppercase tracking-wide mb-2"
            style={{ color: "#16a34a" }}
          >
            ✅ Приети ({accepted.length})
          </div>
          {accepted.map(renderOfferCard)}
        </div>
      )}

      {/* Pending offers */}
      {pending.length > 0 && (
        <div className="mb-4">
          <div
            className="text-xs font-bold uppercase tracking-wide mb-2"
            style={{ color: "#d97706" }}
          >
            ⏳ За решение ({pending.length})
          </div>
          {pending.map(renderOfferCard)}
        </div>
      )}

      {/* Declined offers */}
      {declined.length > 0 && (
        <div className="mb-4">
          <div
            className="text-xs font-bold uppercase tracking-wide mb-2"
            style={{ color: "#dc2626" }}
          >
            ❌ Отказани ({declined.length})
          </div>
          {declined.map(renderOfferCard)}
        </div>
      )}

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
