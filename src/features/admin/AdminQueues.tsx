"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { formatDay, formatMoney, formatWhen, perMonthLabel, todayKey } from "@/lib/format";
import OfferSheet from "./OfferSheet";
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
    q.noInspector.length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Днес" value={q.today.length} icon="calendar" />
        <Stat label="В момента" value={q.running.length} icon="clock" />
        <Stat label="Чакат вас" value={totalWaiting} icon="inbox" highlight={totalWaiting > 0} />
      </div>

      {totalWaiting === 0 && q.unassigned.length === 0 && q.awaitingPrepay.length === 0 && (
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
