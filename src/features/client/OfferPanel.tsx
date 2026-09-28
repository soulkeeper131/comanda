"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "./Section";
import { PhotoGrid } from "./PhotoViewer";
import BankDetails from "./BankDetails";
import { api } from "./api";
import { formatDateOnly, formatMoney, photoUrl } from "./format";
import type { ClientOffer, ClientPayment, OfferDecision } from "./types";

const DECISION: Record<OfferDecision, { text: string; tone: "ok" | "warning" | "danger" | "info" | "neutral" | "accent" }> = {
  pending: { text: "Чака вашето решение", tone: "accent" },
  accepted: { text: "Приета", tone: "info" },
  declined: { text: "Отказана", tone: "neutral" },
  expired: { text: "Изтекла", tone: "neutral" },
  paid: { text: "Платена", tone: "ok" },
  in_progress: { text: "В изпълнение", tone: "info" },
  done: { text: "Завършена", tone: "ok" },
};

/** Офертата по една констатация — решение, плащане, доказателство за ремонта. */
export default function OfferPanel({
  offer,
  pendingPayment,
  onChanged,
}: {
  offer: ClientOffer;
  pendingPayment: ClientPayment | null;
  onChanged: (msg: string) => void;
}) {
  const [busy, setBusy] = useState<"" | "accept" | "decline" | "card" | "bank">("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [bankRequested, setBankRequested] = useState(false);
  const d = DECISION[offer.decision] ?? DECISION.pending;

  const decide = async (decision: "accepted" | "declined") => {
    setBusy(decision === "accepted" ? "accept" : "decline");
    setError("");
    const res = await api(`/api/offers/${offer.id}`, { method: "PATCH", body: { decision } });
    setBusy("");
    if (res.ok) onChanged(decision === "accepted" ? "Офертата е приета." : "Офертата е отказана.");
    else if (res.status === 410) onChanged(res.error || "Офертата вече е изтекла.");
    else setError(res.error);
  };

  const payCard = async () => {
    setBusy("card");
    setError("");
    setInfo("");
    const res = await api<{ url?: string }>("/api/stripe/checkout", { method: "POST", body: { offerId: offer.id } });
    if (res.ok && res.data?.url) {
      window.location.href = res.data.url;
      return;
    }
    setBusy("");
    if (!res.ok && res.status === 503) {
      setInfo("Плащането с карта в момента не е достъпно. Моля, платете по банков път.");
    } else {
      setError(res.ok ? "Не успяхме да отворим плащането. Опитайте отново." : res.error);
    }
  };

  const payBank = async () => {
    setBusy("bank");
    setError("");
    const res = await api("/api/payments", { method: "POST", body: { offer_id: offer.id, method: "transfer" } });
    setBusy("");
    if (res.ok) {
      setBankRequested(true);
      onChanged("Заявихте плащане по банков път. Администраторът ще потвърди, щом преводът пристигне.");
    } else setError(res.error);
  };

  return (
    <div className="space-y-2 rounded-card border border-line bg-brand-bg/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Оферта</div>
          <div className="text-xl font-bold text-ink">{formatMoney(offer.price)}</div>
          {offer.days != null && <div className="text-sm text-muted">Срок за изпълнение: {offer.days} дни</div>}
        </div>
        <Badge tone={d.tone}>{d.text}</Badge>
      </div>

      {offer.scope && <p className="whitespace-pre-line text-sm text-ink">{offer.scope}</p>}

      {offer.decision === "pending" && (
        <>
          <p className="text-sm text-muted">
            {offer.expires_at ? `Валидна до ${formatDateOnly(offer.expires_at)}. ` : ""}
            {offer.requires_prepayment
              ? "Плаща се предварително, преди началото на ремонта."
              : "Плаща се след като ремонтът приключи."}
          </p>
          <div className="flex gap-2">
            <Button fullWidth onClick={() => decide("accepted")} disabled={!!busy}>
              {busy === "accept" ? "Запазване…" : "Приемам"}
            </Button>
            <Button fullWidth variant="secondary" onClick={() => decide("declined")} disabled={!!busy}>
              {busy === "decline" ? "Запазване…" : "Отказвам"}
            </Button>
          </div>
        </>
      )}

      {offer.decision === "accepted" && !offer.awaits_payment && (
        <p className="text-sm text-muted">Приехте офертата. Ще се свържем с вас, за да уговорим ремонта. Плащате след него.</p>
      )}
      {offer.decision === "paid" && (
        <p className="text-sm text-state-ok">
          Платено{offer.paid_at ? ` на ${formatDateOnly(offer.paid_at)}` : ""}.
          {offer.requires_prepayment && !offer.done_at ? " Ще се свържем с вас, за да уговорим ремонта." : ""}
        </p>
      )}
      {offer.decision === "in_progress" && <p className="text-sm text-brand-dark">Ремонтът е в изпълнение.</p>}
      {offer.decision === "done" && (
        <p className="text-sm text-state-ok">
          Ремонтът е завършен{offer.done_at ? ` на ${formatDateOnly(offer.done_at)}` : ""}.
        </p>
      )}
      {offer.decision === "declined" && <p className="text-sm text-muted">Отказахте тази оферта.</p>}
      {offer.decision === "expired" && (
        <p className="text-sm text-muted">
          Офертата изтече{offer.expires_at ? ` на ${formatDateOnly(offer.expires_at)}` : ""}, без да бъде приета.
        </p>
      )}

      {offer.photos.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Icon name="camera" size={16} className="text-brand-primary" />
            Снимки от ремонта
          </p>
          <PhotoGrid
            photos={offer.photos.map((p) => ({ id: p.id, src: photoUrl(p.storage_path), caption: "Снимка от ремонта" }))}
          />
        </div>
      )}

      {offer.awaits_payment && (
        <div className="space-y-2 pt-1">
          <p className="text-sm font-semibold text-ink">
            {offer.decision === "done" ? "Ремонтът е готов — остава плащането." : "За да започнем, остава плащането."}
          </p>
          {pendingPayment || bankRequested ? (
            <>
              <Notice tone="info">
                Заявихте плащане по банков път. Администраторът ще го потвърди, щом преводът пристигне.
              </Notice>
              <BankDetails offerId={offer.id} amount={offer.price} findingTitle={offer.finding?.title} />
            </>
          ) : null}
          {/* Заявен превод → без втори начин на плащане (иначе двойно плащане). */}
          {!pendingPayment && !bankRequested && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button fullWidth onClick={payCard} disabled={!!busy}>
                <Icon name="card" size={18} />
                {busy === "card" ? "Пренасочване…" : "Плати с карта"}
              </Button>
              <Button fullWidth variant="secondary" onClick={payBank} disabled={!!busy}>
                <Icon name="bank" size={18} />
                {busy === "bank" ? "Запазване…" : "Плащане по банков път"}
              </Button>
            </div>
          )}
        </div>
      )}

      {info && <Notice tone="warning">{info}</Notice>}
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  );
}
