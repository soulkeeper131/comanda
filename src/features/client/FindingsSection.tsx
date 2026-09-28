"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice, Section } from "./Section";
import { PhotoGrid } from "./PhotoViewer";
import OfferPanel from "./OfferPanel";
import { api } from "./api";
import { formatWhen, formatMoney } from "./format";
import type { ClientFinding, ClientOffer, ClientPayment } from "./types";

/**
 * „Проблеми и оферти" — какво са открили инспекторите и какво чака клиента.
 * Спешните са най-отгоре и в червено; приключените са свити най-отдолу.
 */
export default function FindingsSection({
  findings,
  offers,
  payments,
  onChanged,
}: {
  findings: ClientFinding[];
  offers: ClientOffer[];
  payments: ClientPayment[];
  onChanged: (msg: string) => void;
}) {
  const [showClosed, setShowClosed] = useState(false);
  const rank = (f: ClientFinding) => (f.severity === "urgent" ? 0 : 1);
  const active = findings.filter((f) => f.status !== "closed").sort((a, b) => rank(a) - rank(b));
  const closed = findings.filter((f) => f.status === "closed");

  const offerFor = (f: ClientFinding): ClientOffer | null =>
    offers.find((o) => o.id === f.offer?.id) ?? offers.find((o) => o.finding_id === f.id) ?? null;
  const pendingPaymentFor = (offerId: string) =>
    payments.find((p) => p.offer_id === offerId && p.status === "pending") ?? null;

  const card = (f: ClientFinding) => (
    <FindingCard
      key={f.id}
      finding={f}
      offer={offerFor(f)}
      pendingPaymentFor={pendingPaymentFor}
      onChanged={onChanged}
    />
  );

  const urgentCount = active.filter((f) => f.severity === "urgent").length;

  return (
    <Section
      title="Проблеми и оферти"
      icon="alert"
      action={urgentCount > 0 ? <Badge tone="danger">{urgentCount} спешни</Badge> : undefined}
    >
      {active.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Icon name="shield" size={18} className="text-state-ok" />
          Няма открити проблеми по имота.
        </p>
      ) : (
        <div className="space-y-3">{active.map(card)}</div>
      )}

      {closed.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowClosed((v) => !v)}
            className="flex min-h-touch w-full items-center justify-between text-sm font-semibold text-brand-secondary"
            aria-expanded={showClosed}
          >
            Приключени ({closed.length})
            <Icon name="chevron-down" size={18} className={`transition-transform ${showClosed ? "rotate-180" : ""}`} />
          </button>
          {showClosed && <div className="space-y-3">{closed.map(card)}</div>}
        </div>
      )}
    </Section>
  );
}

function FindingCard({
  finding,
  offer,
  pendingPaymentFor,
  onChanged,
}: {
  finding: ClientFinding;
  offer: ClientOffer | null;
  pendingPaymentFor: (offerId: string) => ClientPayment | null;
  onChanged: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const urgent = finding.severity === "urgent";

  const requestQuote = async () => {
    setBusy(true);
    setError("");
    const res = await api(`/api/findings/${finding.id}/request-quote`, { method: "POST" });
    setBusy(false);
    if (res.ok) onChanged("Заявката за оферта е изпратена. Ще получите цена до ден-два.");
    else if (res.status === 409) onChanged(res.error);
    else setError(res.error);
  };

  return (
    <div
      className={[
        "space-y-2 rounded-card border p-3",
        urgent ? "border-state-danger/50 bg-state-danger/5" : "border-line",
        finding.status === "closed" ? "opacity-80" : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-2">
        <Icon
          name="alert"
          size={20}
          className={urgent ? "mt-0.5 text-state-danger" : "mt-0.5 text-state-warning"}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {urgent && <Badge tone="danger">Спешно</Badge>}
            <span className={`font-semibold ${urgent ? "text-state-danger" : "text-ink"}`}>{finding.title}</span>
          </div>
          <div className="text-xs text-muted">
            {formatWhen(finding.created_at)}
            {finding.reporter_name ? ` · ${finding.reporter_name}` : ""}
          </div>
        </div>
      </div>

      {finding.body && <p className="whitespace-pre-line text-sm text-ink">{finding.body}</p>}

      {finding.photos.length > 0 && (
        <PhotoGrid photos={finding.photos.map((p) => ({ id: p.id, src: p.url, caption: finding.title }))} />
      )}

      {finding.status === "open" && (
        <Button fullWidth onClick={requestQuote} disabled={busy}>
          <Icon name="wrench" size={18} />
          {busy ? "Изпращане…" : "Искам оферта"}
        </Button>
      )}

      {finding.status === "quote_requested" && (
        <Notice tone="info">Заявена оферта — ще получите цена до ден-два.</Notice>
      )}

      {offer ? (
        <OfferPanel offer={offer} pendingPayment={pendingPaymentFor(offer.id)} onChanged={onChanged} />
      ) : (
        finding.offer && (
          <p className="text-sm text-muted">
            Оферта: {formatMoney(finding.offer.price)}
            {finding.offer.days != null ? ` · ${finding.offer.days} дни` : ""}
          </p>
        )
      )}

      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  );
}
