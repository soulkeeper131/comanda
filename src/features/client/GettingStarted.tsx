"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { formatDateOnly } from "./format";
import type { ClientPlan, ClientProperty } from "./types";

type StepState = "done" | "current" | "todo";
type Step = { title: string; text?: string; state: StepState; tone?: "danger"; action?: { label: string; onClick: () => void } };

/**
 * „Първи стъпки" — от добавения имот до първия отчет: какво е направено,
 * какво чака клиента сега и какво следва. Изчезва с първия завършен обход.
 */
export default function GettingStarted({
  property,
  plan,
  hasReport,
  onChoosePlan,
  onGoToSubscription,
}: {
  property: ClientProperty;
  /** Живият абонамент (или null). */
  plan: ClientPlan | null;
  /** Има ли завършен обход — тогава стъпките не трябват. */
  hasReport: boolean;
  onChoosePlan: () => void;
  onGoToSubscription: () => void;
}) {
  if (hasReport) return null;

  const approved = property.approval_status === "active";
  const rejected = property.approval_status === "rejected";
  const paid = plan?.status === "requested" || plan?.status === "active";
  const scheduled = !!plan?.first_job_at;

  const steps: Step[] = [
    { title: "Имотът е добавен", state: "done" },
    approved
      ? { title: "Имотът е одобрен", state: "done" }
      : rejected
        ? {
            title: "Имотът не е одобрен",
            text: `${property.rejection_reason ? `${property.rejection_reason}. ` : ""}Поправете данните отгоре и го изпратете отново.`,
            state: "current",
            tone: "danger",
          }
        : {
            title: "Проверяваме адреса",
            text: "Одобряваме имота и му възлагаме инспектор — обикновено до един работен ден. Ще ви се обадим.",
            state: "current",
          },
    paid
      ? { title: `Пакет „${plan?.package_name || plan?.name}“`, state: "done" }
      : plan?.status === "pending_payment"
        ? {
            title: "Платете първия месец",
            text: "С карта или по банков превод — данните са в „Абонамент“ по-долу.",
            state: "current",
            action: { label: "Към плащането", onClick: onGoToSubscription },
          }
        : {
            title: "Изберете пакет",
            text: approved ? "Виждате точно какво се проверява при всеки обход, преди да платите." : undefined,
            state: approved ? "current" : "todo",
            action: approved ? { label: "Изберете пакет", onClick: onChoosePlan } : undefined,
          },
    scheduled
      ? { title: `Първият обход е на ${formatDateOnly(plan?.first_job_at)}`, state: "done" }
      : { title: "Уговаряме първия обход", text: paid ? "Ще ви се обадим, за да изберем деня." : undefined, state: paid ? "current" : "todo" },
    {
      title: "Първият отчет със снимки",
      text: scheduled ? "След обхода тук идват снимките от всяка проверена точка." : undefined,
      state: scheduled ? "current" : "todo",
    },
  ];
  const done = steps.filter((s) => s.state === "done").length;

  return (
    <Card padding="md" shadow="sm" className="border-brand-primary/25">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
          <Icon name="list" size={16} className="text-brand-primary" />
          Първи стъпки
        </h2>
        <span className="text-xs font-semibold text-muted">
          {done} от {steps.length}
        </span>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="h-full rounded-full bg-brand-primary transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="space-y-0">
        {steps.map((s, i) => (
          <li key={s.title} className="relative flex gap-3 pb-4 last:pb-0">
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={`absolute left-[13px] top-7 h-[calc(100%-24px)] w-0.5 ${s.state === "done" ? "bg-state-ok/40" : "bg-line"}`}
              />
            )}
            <span
              className={[
                "relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                s.state === "done"
                  ? "bg-state-ok text-white"
                  : s.state === "current"
                    ? s.tone === "danger"
                      ? "bg-state-danger text-white"
                      : "bg-brand-primary text-white ring-4 ring-brand-primary/15"
                    : "border-2 border-line bg-white text-muted",
              ].join(" ")}
            >
              {s.state === "done" ? <Icon name="check" size={14} strokeWidth={3} /> : i + 1}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className={`text-sm ${s.state === "todo" ? "text-muted" : "font-semibold text-ink"}`}>{s.title}</p>
              {s.state === "current" && s.text && (
                <p className={`mt-0.5 text-sm ${s.tone === "danger" ? "text-state-danger" : "text-ink-2"}`}>{s.text}</p>
              )}
              {s.state === "current" && s.action && (
                <Button size="sm" className="mt-2" onClick={s.action.onClick}>
                  {s.action.label}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
