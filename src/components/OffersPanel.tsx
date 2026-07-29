"use client";

type Finding = {
  id: string;
  propertyId: string;
  propertyName: string;
  type: string;
  title: string;
  body: string;
  status: string;
  createdAt: string;
  photos: string[];
  offer: {
    id: string;
    findingId: string;
    price: number;
    days: number;
    scope: string;
    sentAt: string;
    decision: string;
  } | null;
};

type Props = {
  findings: Finding[];
  onAccept: (findingId: string) => void;
  onDecline: (findingId: string) => void;
};

const TYPE_COLORS: Record<string, string> = {
  "Теч": "#dc2626",
  "Мухъл/влага": "#a663cc",
  "Повреда": "#d97706",
  "Липса": "#0891b2",
  "Друго": "#64748b",
};

export default function OffersPanel({ findings, onAccept, onDecline }: Props) {
  const withOffers = findings.filter((f) => f.offer && f.offer.decision === "pending");
  const accepted = findings.filter((f) => f.offer && f.offer.decision === "accepted");
  const declined = findings.filter((f) => f.offer && f.offer.decision === "declined");

  const renderOfferCard = (finding: Finding) => {
    const offer = finding.offer!;
    const isAccepted = offer.decision === "accepted";
    const isDeclined = offer.decision === "declined";

    return (
      <div
        key={finding.id}
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
              background: `${TYPE_COLORS[finding.type] || "#64748b"}18`,
              color: TYPE_COLORS[finding.type] || "#64748b",
            }}
          >
            {finding.type}
          </span>
          <span
            className="text-xs"
            style={{ color: "#247ba0" }}
          >
            {finding.propertyName}
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
          {finding.title}
        </h4>
        <p
          className="text-xs mb-3 leading-relaxed"
          style={{ color: "#64748b" }}
        >
          {finding.body}
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
            {offer.scope}
          </p>
          <div className="flex items-center gap-4">
            <span
              className="text-sm font-bold"
              style={{ color: "#006494" }}
            >
              {offer.price.toFixed(0)} лв
            </span>
            <span
              className="text-xs"
              style={{ color: "#64748b" }}
            >
              ⏱ {offer.days} {offer.days === 1 ? "ден" : "дни"}
            </span>
          </div>
        </div>

        {/* Action buttons - only for pending */}
        {offer.decision === "pending" && (
          <div className="flex gap-2">
            <button
              onClick={() => onAccept(finding.id)}
              className="flex-1 py-2 rounded-lg text-xs font-semibold text-white"
              style={{
                background: "linear-gradient(140deg, #16a34a, #15803d)",
              }}
            >
              ✅ Приеми
            </button>
            <button
              onClick={() => onDecline(finding.id)}
              className="flex-1 py-2 rounded-lg text-xs font-semibold border"
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
      {withOffers.length > 0 && (
        <div className="mb-4">
          <div
            className="text-xs font-bold uppercase tracking-wide mb-2"
            style={{ color: "#d97706" }}
          >
            ⏳ За решение ({withOffers.length})
          </div>
          {withOffers.map(renderOfferCard)}
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
      {withOffers.length === 0 && accepted.length === 0 && declined.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center py-16">
          <div className="text-5xl mb-4">📋</div>
          <h3
            className="text-lg font-bold mb-2"
            style={{ color: "#006494" }}
          >
            Няма оферти
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
