"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { formatDateOnly, formatMoney, perMonthLabel } from "@/lib/format";
import { api } from "./api";
import PackageEditorSheet from "./PackageEditorSheet";
import PaymentsList from "./PaymentsList";
import InquiriesList from "./InquiriesList";
import SchedulePlanSheet from "./SchedulePlanSheet";
import { Chips, EmptyState, SectionTitle } from "./ui";
import type { AdminData, Resource } from "./useAdminData";
import type { AdminPlan, CatalogPackage, ServiceTemplate } from "./types";

type Filter = "pending_payment" | "requested" | "active" | "cancelled" | "catalog" | "payments" | "inquiries";

const PLAN_STATUS: Record<AdminPlan["status"], { text: string; tone: "warning" | "ok" | "neutral" | "info" }> = {
  pending_payment: { text: "Чака плащане", tone: "info" },
  requested: { text: "Чака насрочване", tone: "warning" },
  active: { text: "Активен", tone: "ok" },
  cancelled: { text: "Прекратен", tone: "neutral" },
};

export default function PlansSection({
  data,
  reload,
  toast,
}: {
  data: AdminData;
  reload: (...r: Resource[]) => Promise<void>;
  toast: (text: string, tone?: "ok" | "error") => void;
}) {
  // Отваря се на „Чакат насрочване", само ако има какво да се насрочи.
  const [filter, setFilter] = useState<Filter>(() =>
    data.plans.some((p) => p.status === "requested") ? "requested" : "active",
  );
  const [scheduling, setScheduling] = useState<AdminPlan | null>(null);
  const [catalog, setCatalog] = useState<CatalogPackage[]>([]);
  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  const [editing, setEditing] = useState<CatalogPackage | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const inspectors = data.users.filter((u) => u.role === "inspector" && u.active);

  const loadCatalog = useCallback(async () => {
    const [p, t] = await Promise.all([api<CatalogPackage[]>("/api/packages?all=1"), api<ServiceTemplate[]>("/api/templates")]);
    if (p.ok) setCatalog(p.data);
    if (t.ok) setTemplates(t.data.filter((x) => !x.archived));
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const plans = useMemo(() => data.plans.filter((p) => p.status === filter), [data.plans, filter]);
  const count = (s: AdminPlan["status"]) => data.plans.filter((p) => p.status === s).length;
  const optionNames = (p: AdminPlan) => {
    const ids: string[] = (() => {
      try {
        return JSON.parse(p.options ?? "[]");
      } catch {
        return [];
      }
    })();
    const pkg = catalog.find((c) => c.id === p.package_id);
    return ids.map((id) => pkg?.items.find((i) => i.id === id)?.template_name).filter(Boolean).join(", ");
  };

  const cancel = async (p: AdminPlan) => {
    const text =
      p.status === "active"
        ? `Прекратяване на абонамента за ${p.property_name}? Важи до края на платения период, бъдещите обходи се махат.`
        : `Оттегляне на абонамента за ${p.property_name}?${p.stripe_subscription_id ? " Върнете платената сума от таблото на Stripe." : ""}`;
    if (!confirm(text)) return;
    const res = await api<{ ends_at: string; jobs_removed: number }>(`/api/plans/${p.id}`, {
      method: "PATCH",
      body: { action: "cancel" },
    });
    if (!res.ok) return toast(res.error, "error");
    toast(res.data.ends_at ? `Прекратен — важи до ${formatDateOnly(res.data.ends_at)}, махнати ${res.data.jobs_removed} обхода` : "Оттеглен");
    reload("plans", "jobs");
  };

  return (
    <div>
      <SectionTitle
        action={
          filter === "catalog" ? (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setEditorOpen(true);
              }}
            >
              <Icon name="plus" size={16} /> Пакет
            </Button>
          ) : undefined
        }
      >
        Абонаменти и плащания
      </SectionTitle>
      <Chips
        value={filter}
        onChange={setFilter}
        options={[
          { value: "requested", label: "Чакат насрочване", count: count("requested") },
          { value: "pending_payment", label: "Чакат плащане", count: count("pending_payment") },
          { value: "active", label: "Активни", count: count("active") },
          { value: "cancelled", label: "Прекратени" },
          { value: "catalog", label: "Каталог с пакети" },
          { value: "payments", label: "Плащания" },
          { value: "inquiries", label: "Запитвания", count: data.inquiries.filter((i) => i.status === "new").length },
        ]}
      />

      {filter === "payments" ? (
        <PaymentsList payments={data.payments} />
      ) : filter === "inquiries" ? (
        <InquiriesList
          inquiries={data.inquiries}
          onChanged={(m, tone) => {
            toast(m, tone);
            reload("inquiries");
          }}
        />
      ) : filter === "catalog" ? (
        <div className="space-y-2">
          {catalog.map((pkg) => (
            <button
              key={pkg.id}
              className="block w-full text-left"
              onClick={() => {
                setEditing(pkg);
                setEditorOpen(true);
              }}
            >
              <Card padding="sm" className={pkg.archived ? "opacity-60" : ""}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-ink">{pkg.name}</div>
                    <div className="text-sm text-muted">
                      {perMonthLabel(pkg.per_month)} · {formatMoney(pkg.price)}/месец
                      {pkg.list_price && pkg.list_price > pkg.price ? ` (вместо ${formatMoney(pkg.list_price)})` : ""}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      {pkg.items.map((i) => (i.optional ? `+ ${i.template_name} (${formatMoney(i.extra_price)})` : i.template_name)).join(" · ")}
                    </div>
                  </div>
                  {pkg.archived ? (
                    <Badge>Скрит</Badge>
                  ) : pkg.active_from ? (
                    <Badge tone={pkg.in_season ? "ok" : "neutral"}>
                      Сезон {pkg.active_from}–{pkg.active_to}
                    </Badge>
                  ) : null}
                </div>
              </Card>
            </button>
          ))}
        </div>
      ) : plans.length === 0 ? (
        <EmptyState icon="package" title="Няма абонаменти тук" />
      ) : (
        <div className="space-y-2">
          {plans.map((p) => {
            const st = PLAN_STATUS[p.status];
            const options = optionNames(p);
            return (
              <Card key={p.id} padding="sm">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-ink">{p.property_name}</div>
                    <div className="text-sm text-muted">
                      {p.package_name || p.name} · {perMonthLabel(p.per_month)} · {formatMoney(p.price)}/месец
                    </div>
                    {options && <div className="text-xs text-muted">Опции: {options}</div>}
                    <div className="mt-0.5 text-xs text-muted">
                      {p.owner_name || p.owner_email}
                      {p.first_job_at ? ` · първи обход ${formatDateOnly(p.first_job_at)}` : ""}
                      {p.ends_at ? ` · важи до ${formatDateOnly(p.ends_at)}` : ""}
                      {p.paid_until ? ` · платено до ${formatDateOnly(p.paid_until)}` : ""}
                      {p.stripe_subscription_id ? " · карта" : " · банка"}
                    </div>
                    {p.stripe_status === "past_due" && (
                      <div className="mt-1 text-xs font-semibold text-state-danger">Последното теглене не мина — Stripe опитва пак</div>
                    )}
                  </div>
                  <Badge tone={st.tone}>{st.text}</Badge>
                </div>
                {p.status !== "cancelled" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.status === "requested" && (
                      <Button size="sm" onClick={() => setScheduling(p)}>
                        Насрочи първия обход
                      </Button>
                    )}
                    {p.status === "pending_payment" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          if (!confirm("Клиентът е платил първия месец по банка?")) return;
                          const res = await api(`/api/plans/${p.id}`, { method: "PATCH", body: { action: "mark_paid" } });
                          if (!res.ok) return toast(res.error, "error");
                          toast("Отбелязано — абонаментът чака насрочване");
                          reload("plans");
                        }}
                      >
                        Платено по банка
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => cancel(p)}>
                      Прекрати
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <SchedulePlanSheet
        plan={scheduling}
        property={data.properties.find((x) => x.id === scheduling?.property_id)}
        inspectors={inspectors}
        onClose={() => setScheduling(null)}
        onDone={(m) => {
          setScheduling(null);
          toast(m);
          reload("plans", "jobs", "properties");
        }}
      />
      <PackageEditorSheet
        pkg={editing}
        open={editorOpen}
        templates={templates}
        onClose={() => setEditorOpen(false)}
        onSaved={(m) => {
          setEditorOpen(false);
          toast(m);
          loadCatalog();
        }}
      />
    </div>
  );
}
