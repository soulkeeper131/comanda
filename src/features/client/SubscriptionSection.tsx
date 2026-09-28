"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Notice, Section } from "./Section";
import { api, getOr } from "./api";
import { formatDateOnly, formatDay, formatMoney, perMonthLabel } from "./format";
import type { ApprovalStatus, CatalogPackage, ClientJob, ClientPlan } from "./types";

function parseOptions(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** „Абонамент" — текущият пакет, статусът му и отказ; или покана да се избере. */
export default function SubscriptionSection({
  plan,
  approval,
  nextJob,
  onChoose,
  onChanged,
}: {
  /** Живият абонамент (заявен, активен или отказан, но още в платения период). */
  plan: ClientPlan | null;
  approval: ApprovalStatus;
  nextJob: ClientJob | null;
  onChoose: () => void;
  onChanged: (msg: string) => void;
}) {
  const [catalog, setCatalog] = useState<CatalogPackage[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const optionIds = useMemo(() => parseOptions(plan?.options), [plan?.options]);

  useEffect(() => {
    if (optionIds.length === 0) return;
    getOr<CatalogPackage[]>("/api/packages", []).then(setCatalog);
  }, [optionIds.length]);

  const optionNames = optionIds.map((id) => {
    for (const p of catalog) {
      const item = p.items.find((i) => i.id === id);
      if (item) return item.template_name;
    }
    return null;
  });

  const cancel = async () => {
    if (!plan) return;
    setBusy(true);
    setError("");
    const res = await api<{ ends_at?: string | null }>(`/api/plans/${plan.id}`, {
      method: "PATCH",
      body: { action: "cancel" },
    });
    setBusy(false);
    if (res.ok) {
      setConfirming(false);
      const until = res.data?.ends_at ? ` Обслужването продължава до ${formatDateOnly(res.data.ends_at)}.` : "";
      onChanged(`Абонаментът е прекратен.${until}`);
    } else setError(res.error);
  };

  if (!plan) {
    return (
      <Section title="Абонамент" icon="package">
        {approval === "active" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Имотът все още няма редовно обслужване. Изберете пакет — обходи със снимков отчет всеки път.
            </p>
            <Button fullWidth onClick={onChoose}>
              Изберете пакет
            </Button>
          </div>
        ) : approval === "pending" ? (
          <p className="text-sm text-muted">Ще можете да изберете пакет, след като одобрим имота.</p>
        ) : (
          <p className="text-sm text-muted">Имотът не е одобрен, затова не може да се избере пакет.</p>
        )}
      </Section>
    );
  }

  const redirectTo = async (url: string, body?: unknown) => {
    setBusy(true);
    setError("");
    const res = await api<{ checkout_url?: string; url?: string }>(url, { method: "POST", body });
    if (res.ok && (res.data.checkout_url || res.data.url)) {
      window.location.href = (res.data.checkout_url || res.data.url)!;
      return;
    }
    setBusy(false);
    setError(res.ok ? "Опитайте отново" : res.error);
  };

  const status =
    plan.status === "pending_payment"
      ? { badge: "Чака плащане", tone: "warning" as const, text: "Платете, за да потвърдите заявката." }
      : plan.status === "requested"
      ? { badge: "Заявен", tone: "warning" as const, text: "Ще ви се обадим, за да уговорим първия обход." }
      : plan.status === "active"
        ? {
            badge: "Активен",
            tone: "ok" as const,
            text: nextJob ? `Следващ обход: ${formatDay(nextJob.planned_at)}` : "Следващият обход ще се появи в графика.",
          }
        : {
            badge: "Прекратен",
            tone: "neutral" as const,
            text: `Прекратен — важи до ${formatDateOnly(plan.ends_at)}`,
          };

  return (
    <Section title="Абонамент" icon="package">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-lg font-bold text-ink">{plan.package_name || plan.name}</div>
            <div className="text-sm text-muted first-letter:uppercase">{perMonthLabel(plan.per_month)}</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-brand-dark">{formatMoney(plan.price)}</div>
            <div className="text-xs text-muted">на месец</div>
          </div>
        </div>

        {optionIds.length > 0 && (
          <div className="text-sm text-ink-2">
            Допълнително:{" "}
            {optionNames.every((n) => n) ? optionNames.join(", ") : `${optionIds.length} опции`}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Badge tone={status.tone}>{status.badge}</Badge>
          <span className="text-sm text-ink">{status.text}</span>
        </div>

        {plan.stripe_status === "past_due" && (
          <Notice tone="danger">Последното месечно плащане не мина. Обновете картата, за да не спират обходите.</Notice>
        )}
        {error && !confirming && <Notice tone="danger">{error}</Notice>}
        {plan.status === "pending_payment" && (
          <Button fullWidth disabled={busy} onClick={() => redirectTo(`/api/plans/${plan.id}/checkout`)}>
            {busy ? "Пренасочване…" : `Плати ${formatMoney(plan.price)} с карта`}
          </Button>
        )}
        {plan.stripe_subscription_id && plan.status !== "pending_payment" && (
          <Button variant="secondary" fullWidth disabled={busy} onClick={() => redirectTo("/api/stripe/portal")}>
            Карта и плащания
          </Button>
        )}
        {plan.paid_until && plan.status !== "cancelled" && (
          <p className="text-xs text-muted">Платено до {formatDateOnly(plan.paid_until)}. Следващото плащане е автоматично.</p>
        )}

        {plan.status !== "cancelled" && (
          <Button variant="ghost" size="sm" className="min-h-touch text-state-danger" onClick={() => setConfirming(true)}>
            Прекратяване на абонамента
          </Button>
        )}
      </div>

      <Sheet open={confirming} onClose={() => setConfirming(false)} placement="bottom" className="mx-auto max-w-lg p-5">
        <h3 className="text-lg font-bold text-ink">Прекратяване на абонамента?</h3>
        <p className="mt-2 text-sm text-muted">
          {plan.status === "pending_payment"
            ? "Заявката ще бъде оттеглена. Не сте платили нищо."
            : plan.status === "requested"
            ? "Заявката ви ще бъде оттеглена и няма да насрочваме обходи. Платената сума ще ви бъде върната."
            : "Обслужването продължава до края на платения период. Обходите след това ще бъдат премахнати от графика."}
        </p>
        {error && (
          <div className="mt-3">
            <Notice tone="danger">{error}</Notice>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" fullWidth onClick={() => setConfirming(false)}>
            Не, остави
          </Button>
          <Button variant="danger" fullWidth onClick={cancel} disabled={busy}>
            {busy ? "Прекратяване…" : "Да, прекрати"}
          </Button>
        </div>
      </Sheet>
    </Section>
  );
}
