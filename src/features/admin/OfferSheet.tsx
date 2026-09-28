"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/format";
import { api } from "./api";
import { Field, inputClass } from "./ui";
import type { AdminFinding } from "./types";

/**
 * Нова оферта по констатация. Офертата е валидна 7 дни; дали се плаща
 * предварително решава прагът (Настройки) — показваме го, за да е ясно
 * какво ще види клиентът.
 */
export default function OfferSheet({
  finding,
  threshold,
  onClose,
  onCreated,
}: {
  finding: AdminFinding | null;
  threshold: number;
  onClose: () => void;
  onCreated: (message: string) => void;
}) {
  const [price, setPrice] = useState("");
  const [days, setDays] = useState("3");
  const [scope, setScope] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (finding) {
      setPrice("");
      setDays("3");
      setScope("");
      setError("");
    }
  }, [finding]);

  const priceNum = Number(price.replace(",", "."));
  const prepay = Number.isFinite(priceNum) && priceNum >= threshold;

  const submit = async () => {
    if (!finding) return;
    setBusy(true);
    setError("");
    const res = await api("/api/offers", {
      body: { finding_id: finding.id, price: priceNum, days: Number(days), scope },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onCreated("Офертата е изпратена на клиента");
  };

  return (
    <Sheet open={!!finding} onClose={onClose} placement="bottom" className="max-h-[90dvh] overflow-y-auto p-5">
      {finding && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-ink">Оферта</h3>
              {finding.severity === "urgent" && <Badge tone="danger">Спешно</Badge>}
            </div>
            <p className="text-sm text-muted">
              {finding.property_name} — {finding.title}
            </p>
            {finding.body && <p className="mt-1 text-sm text-ink-2">{finding.body}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Цена (€)">
              <input className={inputClass} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            </Field>
            <Field label="Срок (дни)">
              <input className={inputClass} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
            </Field>
          </div>
          <Field label="Какво включва">
            <textarea
              className={`${inputClass} min-h-[88px] py-2`}
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="Напр. смяна на сифон и уплътнения, материали включени"
            />
          </Field>
          {Number.isFinite(priceNum) && priceNum > 0 && (
            <p className="rounded-card bg-brand-bg px-3 py-2 text-sm text-brand-secondary">
              {prepay
                ? `${formatMoney(priceNum)} — над прага от ${formatMoney(threshold)}: клиентът плаща преди работата.`
                : `${formatMoney(priceNum)} — под прага от ${formatMoney(threshold)}: работата тръгва веднага, плаща се след нея.`}{" "}
              Валидна 7 дни.
            </p>
          )}
          {error && <p className="rounded-card bg-state-danger/10 px-3 py-2 text-sm text-state-danger">{error}</p>}
          <div className="flex gap-2 pb-2">
            <Button variant="secondary" fullWidth onClick={onClose}>
              Отказ
            </Button>
            <Button fullWidth disabled={busy || !(priceNum > 0) || !scope.trim() || !(Number(days) > 0)} onClick={submit}>
              Изпрати офертата
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
