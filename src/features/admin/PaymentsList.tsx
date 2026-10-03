"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { formatMoney, formatWhen } from "@/lib/format";
import { EmptyState } from "./ui";
import type { AdminPayment } from "./types";

const STATUS: Record<string, { text: string; tone: "ok" | "warning" | "danger" | "neutral" }> = {
  paid: { text: "Платено", tone: "ok" },
  pending: { text: "Чака", tone: "warning" },
  refund_needed: { text: "За връщане", tone: "danger" },
  refunded: { text: "Върнато", tone: "neutral" },
  cancelled: { text: "Отказано", tone: "neutral" },
  failed: { text: "Неуспешно", tone: "danger" },
};

/** Всички плащания с фактурите им — дневникът на парите. */
export default function PaymentsList({ payments }: { payments: AdminPayment[] }) {
  if (payments.length === 0) return <EmptyState icon="card" title="Още няма плащания" />;
  const month = new Date().toISOString().slice(0, 7);
  const monthTotal = payments
    .filter((p) => p.status === "paid" && (p.paid_at ?? "").slice(0, 7) === month)
    .reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-2">
      <Card padding="sm" className="flex items-center justify-between">
        <span className="text-sm text-muted">Постъпления този месец</span>
        <span className="text-lg font-bold text-ink">{formatMoney(monthTotal)}</span>
      </Card>
      {payments.map((p) => {
        const st = STATUS[p.status] ?? { text: p.status, tone: "neutral" as const };
        return (
          <Card key={p.id} padding="sm" className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-ink">
                {formatMoney(p.amount)} · {p.user_name || p.user_email}
              </div>
              <div className="truncate text-sm text-muted">{p.description}</div>
              <div className="text-xs text-muted">
                {p.method === "card" ? "Карта" : "Банка"} · {formatWhen(p.paid_at ?? p.created_at)}
              </div>
            </div>
            {p.invoice_id && (
              <a
                href={`/api/invoices/${p.invoice_id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs font-semibold text-brand-primary"
                title="Фактура"
              >
                <Icon name="download" size={16} /> {p.invoice_number}
              </a>
            )}
            <Badge tone={st.tone}>{st.text}</Badge>
          </Card>
        );
      })}
    </div>
  );
}
