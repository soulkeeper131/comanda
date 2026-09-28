"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { formatMoney, perMonthLabel, todayKey } from "@/lib/format";
import { api } from "./api";
import { Field, inputClass } from "./ui";
import type { AdminPlan, AdminProperty, AdminUser } from "./types";

/**
 * Насрочване на първия обход (въпрос 7): админът се обажда на клиента,
 * уговаря дата и я въвежда тук. Системата създава обходите три месеца
 * напред. Ако имотът няма инспектор — избира се тук, за да не станат
 * обходите „без изпълнител".
 */
export default function SchedulePlanSheet({
  plan,
  property,
  inspectors,
  onClose,
  onDone,
}: {
  plan: AdminPlan | null;
  property: AdminProperty | undefined;
  inspectors: AdminUser[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [date, setDate] = useState(todayKey());
  const [inspectorId, setInspectorId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (plan) {
      setDate(todayKey());
      setInspectorId(plan.assigned_inspector_id ?? "");
      setError("");
    }
  }, [plan]);

  const submit = async () => {
    if (!plan) return;
    setBusy(true);
    setError("");
    if (inspectorId && inspectorId !== plan.assigned_inspector_id) {
      const r = await api(`/api/properties/${plan.property_id}`, {
        method: "PATCH",
        body: { assigned_inspector_id: inspectorId },
      });
      if (!r.ok) {
        setBusy(false);
        setError(r.error);
        return;
      }
    }
    const res = await api<{ jobs_created: number }>(`/api/plans/${plan.id}`, {
      method: "PATCH",
      body: { first_job_at: date },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onDone(`Насрочено — създадени ${res.data.jobs_created} обхода`);
  };

  const phone = plan?.contact_phone || plan?.owner_phone;

  return (
    <Sheet open={!!plan} onClose={onClose} placement="bottom" className="max-h-[90dvh] overflow-y-auto p-5">
      {plan && (
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-bold text-ink">Първи обход</h3>
            <p className="text-sm text-muted">
              {plan.property_name} · {plan.package_name || plan.name} · {perMonthLabel(plan.per_month)} ·{" "}
              {formatMoney(plan.price)}/месец
            </p>
            {property?.address && <p className="text-sm text-muted">{property.address}</p>}
          </div>
          <div className="rounded-card bg-brand-bg px-3 py-2 text-sm text-ink-2">
            <div className="font-semibold">{plan.owner_name || plan.owner_email}</div>
            {plan.contact_name && <div>Контакт за достъп: {plan.contact_name}</div>}
            {phone && (
              <a href={`tel:${phone}`} className="mt-1 inline-flex items-center gap-1.5 font-semibold text-brand-primary">
                <Icon name="phone" size={16} /> {phone}
              </a>
            )}
          </div>
          <Field label="Дата на първия обход" hint="Следващите се насрочват автоматично; празниците се прескачат.">
            <input type="date" className={inputClass} min={todayKey()} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Инспектор на имота">
            <select className={inputClass} value={inspectorId} onChange={(e) => setInspectorId(e.target.value)}>
              <option value="">— без инспектор —</option>
              {inspectors.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
          </Field>
          {!inspectorId && (
            <p className="text-sm text-state-warning">Без инспектор обходите ще са невъзложени.</p>
          )}
          {error && <p className="rounded-card bg-state-danger/10 px-3 py-2 text-sm text-state-danger">{error}</p>}
          <div className="flex gap-2 pb-2">
            <Button variant="secondary" fullWidth onClick={onClose}>
              Отказ
            </Button>
            <Button fullWidth disabled={busy || !date} onClick={submit}>
              Насрочи
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
