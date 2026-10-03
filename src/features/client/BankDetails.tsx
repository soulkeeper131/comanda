"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { bankReference, type PaymentKind } from "@/lib/format";
import { getOr } from "./api";
import { formatMoney } from "./format";

type Details = { iban: string | null; recipient: string | null; bank: string | null };

/**
 * Данните за превод — получател, IBAN, банка, сума, основание. Основанието
 * казва за какво е преводът (ремонт, услуга, абонамент) и е уникално, за да
 * го разпознае администраторът в извлечението.
 */
export default function BankDetails({
  kind,
  id,
  amount,
  label,
}: {
  kind: PaymentKind;
  id: string;
  amount: number | null;
  label?: string | null;
}) {
  const [details, setDetails] = useState<Details | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getOr<Details>("/api/payments/bank-details", { iban: null, recipient: null, bank: null }).then((d) => {
      if (!cancelled) setDetails(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!details) return <p className="text-sm text-muted">Зареждане на данните за превод…</p>;
  if (!details.iban) {
    return <p className="text-sm text-ink">Свържете се с нас за данни за превод.</p>;
  }

  const iban = details.iban;
  const reference = `${bankReference(kind, id)}${label ? ` — ${label}` : ""}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(iban.replace(/\s+/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  );

  return (
    <dl className="space-y-2 rounded-card border border-line bg-white p-3">
      {details.recipient && <Row label="Получател">{details.recipient}</Row>}
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-muted">IBAN</dt>
        <dd className="flex items-center gap-2">
          <span className="min-w-0 flex-1 select-all break-all font-mono text-sm text-ink">{iban}</span>
          <button
            type="button"
            onClick={copy}
            className="flex min-h-touch shrink-0 items-center gap-1 rounded-card px-2 text-sm font-semibold text-brand-primary hover:bg-brand-bg"
            aria-label="Копирай IBAN"
          >
            <Icon name={copied ? "check" : "clipboard"} size={16} />
            {copied ? "Копирано" : "Копирай"}
          </button>
        </dd>
      </div>
      {details.bank && <Row label="Банка">{details.bank}</Row>}
      <Row label="Сума">
        <span className="font-bold">{formatMoney(amount)}</span>
      </Row>
      <Row label="Основание">
        <span className="select-all">{reference}</span>
      </Row>
    </dl>
  );
}
