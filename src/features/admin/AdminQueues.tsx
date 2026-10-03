"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { formatDay, formatMoney, formatWhen, perMonthLabel, todayKey } from "@/lib/format";
import OfferSheet from "./OfferSheet";
import { api } from "./api";
import SchedulePlanSheet from "./SchedulePlanSheet";
import type { AdminData, Resource } from "./useAdminData";
import type { AdminFinding, AdminPlan } from "./types";

type Props = {
  data: AdminData;
  threshold: number;
  reload: (...r: Resource[]) => Promise<void>;
  toast: (text: string, tone?: "ok" | "error") => void;
  openProperty: (id: string) => void;
  goTo: (section: "jobs" | "issues" | "plans") => void;
};

/**
 * Таблото на админа — не статистики, а работни опашки (въпроси 7, 12, 17,
 * 19, 22б, 24): всичко, което чака човек, на едно място, с действие до него.
 * Празна опашка не се показва; празно табло значи „нищо не чака".
 */
export default function AdminQueues({ data, threshold, reload, toast, openProperty, goTo }: Props) {
  const [offerFor, setOfferFor] = useState<AdminFinding | null>(null);
  const [scheduling, setScheduling] = useState<AdminPlan | null>(null);
  const today = todayKey();

  const confirmBank = async (paymentId: string) => {
    if (!confirm("Сумата е постъпила по сметката?")) return;
    const res = await api<{ invoice: string | null }>("/api/payments/confirm", { body: { paymentId } });
    toast(res.ok ? `Потвърдено${res.data.invoice ? ` — фактура ${res.data.invoice}` : ""}` : res.error, res.ok ? "ok" : "error");
    reload("payments", "offers", "findings");
  };
  const paymentAction = async (id: string, status: string, message: string) => {
    const res = await api(`/api/payments/${id}`, { method: "PATCH", body: { status } });
    toast(res.ok ? message : res.error, res.ok ? "ok" : "error");
    reload("payments");
  };
  const markPlanPaid = async (planId: string) => {
    if (!confirm("Преводът за следващия месец е получен?")) return;
    const res = await api<{ invoice?: string | null }>(`/api/plans/${planId}`, { method: "PATCH", body: { action: "mark_paid" } });
    toast(res.ok ? `Платено${res.data.invoice ? ` — фактура ${res.data.invoice}` : ""}` : res.error, res.ok ? "ok" : "error");
    reload("plans", "payments");
  };
  const inquiryAction = async (id: string, status: string) => {
    const res = await api(`/api/inquiries/${id}`, { method: "PATCH", body: { status } });
    if (!res.ok) toast(res.error, "error");
    reload("inquiries");
  };
  const inspectors = data.users.filter((u) => u.role === "inspector" && u.active);

  const q = useMemo(() => {
    const livePlanProps = new Set(
      data.plans.filter((p) => p.status === "active" || p.status === "requested").map((p) => p.property_id),
    );
    return {
      pendingProps: data.properties.filter((p) => p.approval_status === "pending"),
      requestedPlans: data.plans.filter((p) => p.status === "requested"),
      urgent: data.findings.filter((f) => f.severity === "urgent" && f.status === "open"),
      quoteRequests: data.findings.filter((f) => f.status === "quote_requested"),
      overdue: data.jobs.filter((j) => j.status === "planned" && j.planned_at.slice(0, 10) < today),
      unassigned: data.jobs.filter(
        (j) => j.status === "planned" && !j.assignee_id && j.planned_at.slice(0, 10) >= today,
      ),
      unpaid: data.offers.filter((o) => o.awaits_payment && o.decision === "done"),
      awaitingPrepay: data.offers.filter((o) => o.awaits_payment && o.decision === "accepted"),
      noInspector: data.properties.filter(
        (p) => p.approval_status === "active" && !p.assigned_inspector_id && livePlanProps.has(p.id),
      ),
      bankPending: data.payments.filter((p) => p.status === "pending" && p.method !== "card"),
      // Абонамент без карта, чийто платен период е изтекъл (или никога не е
      // платен) — обходите вървят (до 14 дни), а парите не са дошли.
      // Сезонен пакет извън сезона не е тук — сървърът смята просрочието.
      unpaidPlans: data.plans.filter(
        (p) =>
          (p.status === "active" || p.status === "requested") &&
          !p.stripe_subscription_id &&
          (!p.paid_until || !!p.suspended_at || p.overdue_days > 0),
      ),
      // Приет ремонт, който може да започне: плащане след ремонта — веднага;
      // с предплащане — щом е платено.
      readyRepairs: data.offers.filter(
        (o) => (o.decision === "accepted" && !o.requires_prepayment) || o.decision === "paid",
      ),
      // Обход, започнат преди повече от 12 часа и незавършен — телефонът е
      // изгубен, инспекторът е забравил; клиентът чака отчет.
      stuck: data.jobs.filter(
        (j) => j.status === "in_progress" && !!j.check_in && Date.now() - new Date(j.check_in).getTime() > 12 * 3600_000,
      ),
      refunds: data.payments.filter((p) => p.status === "refund_needed"),
      inquiries: data.inquiries.filter((i) => i.status === "new"),
      today: data.jobs.filter((j) => j.planned_at.slice(0, 10) === today && j.status !== "cancelled"),
      running: data.jobs.filter((j) => j.status === "in_progress"),
    };
  }, [data, today]);

  const totalWaiting =
    q.pendingProps.length +
    q.requestedPlans.length +
    q.urgent.length +
    q.quoteRequests.length +
    q.overdue.length +
    q.unpaid.length +
    q.noInspector.length +
    q.bankPending.length +
    q.refunds.length +
    q.inquiries.length +
    q.unpaidPlans.length +
    q.readyRepairs.length +
    q.stuck.length +
    q.unassigned.length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Днес" value={q.today.length} icon="calendar" />
        <Stat label="В момента" value={q.running.length} icon="clock" />
        <Stat label="Чакат вас" value={totalWaiting} icon="inbox" highlight={totalWaiting > 0} />
      </div>

      {totalWaiting === 0 && q.awaitingPrepay.length === 0 && (
        <Card className="flex items-center gap-3">
          <Icon name="check-circle" size={28} className="text-state-ok" />
          <div>
            <div className="font-semibold text-ink">Нищо не чака</div>
            <div className="text-sm text-muted">Всички заявки, оферти и обходи са в ред.</div>
          </div>
        </Card>
      )}

      <Queue title="Спешни констатации" icon="alert" tone="danger" items={q.urgent}>
        {(f) => (
          <Row
            key={f.id}
            title={f.title}
            sub={`${f.property_name} · ${formatWhen(f.created_at)}`}
            action={<Button size="sm" variant="danger" onClick={() => setOfferFor(f)}>Оферта</Button>}
          />
        )}
      </Queue>

      <Queue title="Суми за връщане" icon="card" tone="danger" items={q.refunds}>
        {(p) => (
          <Row
            key={p.id}
            title={`${p.user_name || p.user_email} — ${formatMoney(p.amount)}`}
            sub={`${p.description} · ${p.method === "card" ? "връща се автоматично в картата" : "преведете сумата, после отбележете"}`}
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (!confirm(p.method === "card" ? `Да върнем ${formatMoney(p.amount)} в картата на клиента?` : "Сумата е преведена обратно на клиента?")) return;
                  paymentAction(p.id, "refunded", p.method === "card" ? "Върнато в картата — издадено кредитно известие" : "Отбелязано като върнато — издадено кредитно известие");
                }}
              >
                {p.method === "card" ? "Върни" : "Върнато"}
              </Button>
            }
          />
        )}
      </Queue>

      <Queue title="Преводи за потвърждение" icon="bank" items={q.bankPending}>
        {(p) => (
          <Row
            key={p.id}
            title={`${p.user_name || p.user_email} — ${formatMoney(p.amount)}`}
            sub={`${p.reference ? `„${p.reference}“ · ` : ""}${p.description} · заявен ${formatWhen(p.created_at)}`}
            action={
              <Button size="sm" onClick={() => confirmBank(p.id)}>
                Получен
              </Button>
            }
          />
        )}
      </Queue>

      <Queue title="Абонаменти без плащане" icon="bank" tone="warning" items={q.unpaidPlans}>
        {(p) => (
          <Row
            key={p.id}
            title={`${p.property_name} — ${formatMoney(p.price)}/месец`}
            sub={`${p.owner_name ?? p.owner_email} · ${
              p.suspended_at
                ? "обходите са спрени до плащането"
                : p.paid_until
                  ? `${p.overdue_days} ${p.overdue_days === 1 ? "ден" : "дни"} просрочие — спира на 15-ия`
                  : "не е плащан"
            }`}
            action={
              <Button size="sm" variant="secondary" onClick={() => markPlanPaid(p.id)}>
                Платен
              </Button>
            }
          />
        )}
      </Queue>

      <Queue title="Обходи, започнати и незавършени" icon="clock" tone="warning" items={q.stuck} onMore={() => goTo("jobs")}>
        {(j) => (
          <Row
            key={j.id}
            title={j.property_name ?? "Обход"}
            sub={`${j.assignee_name ?? "без изпълнител"} · започнат ${formatWhen(j.check_in)}`}
          />
        )}
      </Queue>

      <Queue title="Приети ремонти — за започване" icon="wrench" items={q.readyRepairs} onMore={() => goTo("issues")}>
        {(o) => (
          <Row
            key={o.id}
            title={`${o.finding.property_name} — ${formatMoney(o.price)}`}
            sub={`${o.finding.title} · ${o.decision === "paid" ? "платен предварително" : "плащане след ремонта"}`}
            action={<Button size="sm" variant="secondary" onClick={() => goTo("issues")}>Отвори</Button>}
          />
        )}
      </Queue>

      <Queue title="Нови запитвания от сайта" icon="mail" items={q.inquiries}>
        {(i) => (
          <Row
            key={i.id}
            title={`${i.full_name}${i.city ? ` · ${i.city}` : ""}`}
            sub={[i.phone, i.email, i.service, i.message].filter(Boolean).join(" · ")}
            action={
              <div className="flex gap-1">
                {i.phone && (
                  <a href={`tel:${i.phone}`} className="flex h-9 w-9 items-center justify-center rounded-card text-brand-primary hover:bg-brand-bg" aria-label="Обади се">
                    <Icon name="phone" size={18} />
                  </a>
                )}
                <Button size="sm" variant="secondary" onClick={() => inquiryAction(i.id, "contacted")}>
                  Свързах се
                </Button>
              </div>
            }
          />
        )}
      </Queue>

      <Queue title="Имоти за одобрение" icon="home" items={q.pendingProps}>
        {(p) => (
          <Row
            key={p.id}
            title={p.name}
            sub={`${p.address ?? ""} · ${p.owner_name ?? ""}`}
            action={<Button size="sm" onClick={() => openProperty(p.id)}>Прегледай</Button>}
          />
        )}
      </Queue>

      <Queue title="Абонаменти за насрочване" icon="calendar" items={q.requestedPlans}>
        {(p) => (
          <Row
            key={p.id}
            title={`${p.property_name} — ${p.package_name || p.name}`}
            sub={`${perMonthLabel(p.per_month)} · ${formatMoney(p.price)}/месец · заявен ${formatWhen(p.started_at)}`}
            action={<Button size="sm" onClick={() => setScheduling(p)}>Насрочи</Button>}
          />
        )}
      </Queue>

      <Queue title="Заявени оферти" icon="wrench" items={q.quoteRequests}>
        {(f) => (
          <Row
            key={f.id}
            title={f.title}
            sub={`${f.property_name} · заявена ${formatWhen(f.quote_requested_at)}`}
            action={<Button size="sm" onClick={() => setOfferFor(f)}>Оферта</Button>}
          />
        )}
      </Queue>

      <Queue title="Просрочени обходи" icon="clock" tone="warning" items={q.overdue} onMore={() => goTo("jobs")}>
        {(j) => (
          <Row
            key={j.id}
            title={j.property_name ?? "Обход"}
            sub={`${formatDay(j.planned_at)} · ${j.assignee_name ?? "без изпълнител"}`}
          />
        )}
      </Queue>

      <Queue title="Имоти с абонамент, без инспектор" icon="user" items={q.noInspector}>
        {(p) => (
          <Row
            key={p.id}
            title={p.name}
            sub={p.address ?? ""}
            action={<Button size="sm" variant="secondary" onClick={() => openProperty(p.id)}>Назначи</Button>}
          />
        )}
      </Queue>

      <Queue title="Обходи без изпълнител" icon="users" items={q.unassigned} onMore={() => goTo("jobs")}>
        {(j) => <Row key={j.id} title={j.property_name ?? "Обход"} sub={formatDay(j.planned_at)} />}
      </Queue>

      <Queue title="Завършени, неплатени" icon="bank" items={q.unpaid} onMore={() => goTo("issues")}>
        {(o) => (
          <Row
            key={o.id}
            title={`${o.finding.property_name} — ${formatMoney(o.price)}`}
            sub={`${o.finding.title} · завършен ${formatWhen(o.done_at)}`}
          />
        )}
      </Queue>

      <Queue title="Приети, чакат предплащане" icon="card" items={q.awaitingPrepay} onMore={() => goTo("issues")}>
        {(o) => <Row key={o.id} title={`${o.finding.property_name} — ${formatMoney(o.price)}`} sub={o.finding.title} />}
      </Queue>

      <OfferSheet
        finding={offerFor}
        threshold={threshold}
        onClose={() => setOfferFor(null)}
        onCreated={(m) => {
          setOfferFor(null);
          toast(m);
          reload("findings", "offers");
        }}
      />
      <SchedulePlanSheet
        plan={scheduling}
        property={data.properties.find((p) => p.id === scheduling?.property_id)}
        inspectors={inspectors}
        onClose={() => setScheduling(null)}
        onDone={(m) => {
          setScheduling(null);
          toast(m);
          reload("plans", "jobs", "properties");
        }}
      />
    </div>
  );
}

function Stat({ label, value, icon, highlight }: { label: string; value: number; icon: IconName; highlight?: boolean }) {
  return (
    <Card padding="sm" className={highlight ? "border-brand-primary/40 bg-brand-primary/5" : ""}>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        <Icon name={icon} size={14} /> {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${highlight ? "text-brand-primary" : "text-ink"}`}>{value}</div>
    </Card>
  );
}

function Queue<T>({
  title,
  icon,
  tone,
  items,
  children,
  onMore,
}: {
  title: string;
  icon: IconName;
  tone?: "danger" | "warning";
  items: T[];
  children: (item: T) => ReactNode;
  onMore?: () => void;
}) {
  if (items.length === 0) return null;
  const shown = items.slice(0, 6);
  return (
    <Card padding="none" className={tone === "danger" ? "border-state-danger/40" : ""}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <Icon
          name={icon}
          size={18}
          className={tone === "danger" ? "text-state-danger" : tone === "warning" ? "text-state-warning" : "text-brand-secondary"}
        />
        <h3 className="flex-1 text-sm font-bold text-ink">{title}</h3>
        <Badge tone={tone ?? "info"}>{items.length}</Badge>
      </div>
      <div className="divide-y divide-line">{shown.map(children)}</div>
      {(items.length > shown.length || onMore) && onMore && (
        <button onClick={onMore} className="flex w-full items-center justify-center gap-1 py-2.5 text-sm font-semibold text-brand-primary">
          Виж всички <Icon name="chevron-right" size={16} />
        </button>
      )}
    </Card>
  );
}

function Row({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-ink">{title}</div>
        {sub && <div className="truncate text-sm text-muted">{sub}</div>}
      </div>
      {action}
    </div>
  );
}
