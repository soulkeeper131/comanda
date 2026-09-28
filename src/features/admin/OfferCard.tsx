"use client";

import { useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { formatDateOnly, formatMoney, formatWhen, photoUrl } from "@/lib/format";
import { api, uploadPhoto } from "./api";
import { PhotoStrip } from "./ui";
import type { AdminOffer, OfferDecision } from "./types";

export const OFFER_STATUS: Record<OfferDecision, { text: string; tone: "neutral" | "info" | "ok" | "danger" | "warning" | "accent" }> = {
  pending: { text: "Чака клиента", tone: "warning" },
  accepted: { text: "Приета", tone: "info" },
  declined: { text: "Отказана", tone: "neutral" },
  expired: { text: "Изтекла", tone: "neutral" },
  paid: { text: "Платена", tone: "accent" },
  in_progress: { text: "В изпълнение", tone: "info" },
  done: { text: "Завършена", tone: "ok" },
};

/**
 * Една оферта и следващата ѝ стъпка. Ремонтът се прави от външен майстор
 * (въпрос 20б) — админът движи статуса и прикача снимките, които майсторът
 * е изпратил (въпрос 23), за да има и тук доказателство.
 */
export default function OfferCard({
  offer,
  onChanged,
  onOpenPhoto,
}: {
  offer: AdminOffer;
  onChanged: (message: string, tone?: "ok" | "error") => void;
  onOpenPhoto: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const st = OFFER_STATUS[offer.decision];

  const move = async (decision: OfferDecision, message: string) => {
    setBusy(true);
    const res = await api(`/api/offers/${offer.id}`, { method: "PATCH", body: { decision } });
    setBusy(false);
    onChanged(res.ok ? message : res.error, res.ok ? "ok" : "error");
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    let added = 0;
    for (const file of Array.from(files)) {
      const up = await uploadPhoto(file);
      if (!up.ok) {
        setBusy(false);
        return onChanged(up.error, "error");
      }
      const res = await api(`/api/offers/${offer.id}/photos`, { body: { storage_path: up.data.id } });
      if (res.ok) added++;
    }
    setBusy(false);
    onChanged(`Добавени ${added} снимки`);
  };

  const next: { label: string; to: OfferDecision; confirm?: string }[] = [];
  if (offer.decision === "accepted" && offer.requires_prepayment) {
    next.push({ label: "Платено по банка", to: "paid", confirm: "Потвърждавате ли, че сумата е получена по банка?" });
  }
  if ((offer.decision === "accepted" && !offer.requires_prepayment) || offer.decision === "paid") {
    next.push({ label: "Започни ремонта", to: "in_progress" });
  }
  if (offer.decision === "in_progress") next.push({ label: "Ремонтът е завършен", to: "done" });
  if (offer.decision === "done" && offer.awaits_payment) {
    next.push({ label: "Платено", to: "paid", confirm: "Потвърждавате ли, че сумата е получена?" });
  }
  const canAddPhotos = offer.decision === "in_progress" || offer.decision === "done" || offer.decision === "paid";

  return (
    <Card padding="sm">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-ink">
            {offer.finding.property_name} — {formatMoney(offer.price)}
          </div>
          <div className="text-sm text-muted">{offer.finding.title}</div>
          {offer.scope && <div className="mt-1 text-sm text-ink-2">{offer.scope}</div>}
          <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
            <span>{offer.requires_prepayment ? "Предплащане" : "Плащане след работата"}</span>
            {offer.decision === "pending" && offer.expires_at && <span>Валидна до {formatDateOnly(offer.expires_at)}</span>}
            {offer.done_at && <span>Завършен {formatWhen(offer.done_at)}</span>}
            {offer.paid_at && <span>Платен {formatWhen(offer.paid_at)}</span>}
            {offer.awaits_payment && offer.decision === "done" && <span className="font-semibold text-state-warning">Неплатен</span>}
          </div>
          <PhotoStrip urls={offer.photos.map((p) => photoUrl(p.storage_path))} onOpen={onOpenPhoto} />
        </div>
        <Badge tone={st.tone}>{st.text}</Badge>
      </div>
      {(next.length > 0 || canAddPhotos || offer.decision === "pending") && (
        <div className="mt-3 flex flex-wrap gap-2">
          {next.map((n) => (
            <Button
              key={n.to}
              size="sm"
              disabled={busy}
              onClick={() => {
                if (!n.confirm || confirm(n.confirm)) move(n.to, `Офертата е „${OFFER_STATUS[n.to].text.toLowerCase()}"`);
              }}
            >
              {n.label}
            </Button>
          ))}
          {canAddPhotos && (
            <>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
                <Icon name="camera" size={16} /> Снимки от майстора
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  addPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
            </>
          )}
          {offer.decision === "pending" && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                if (!confirm("Да изтрия ли офертата? Клиентът вече може да я е видял.")) return;
                setBusy(true);
                const res = await api(`/api/offers/${offer.id}`, { method: "DELETE" });
                setBusy(false);
                onChanged(res.ok ? "Офертата е изтрита" : res.error, res.ok ? "ok" : "error");
              }}
            >
              <Icon name="trash" size={16} /> Изтрий
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
