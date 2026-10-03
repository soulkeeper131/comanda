"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { todayKey } from "@/lib/format";
import { api } from "./api";
import { Field, inputClass } from "./ui";
import type { AdminProperty, AdminUser, ServiceTemplate } from "./types";

/**
 * Еднократен обход извън абонамента — напр. допълнителна услуга („този месец
 * и прозорците", уточнение 6б) или проверка след буря.
 */
export default function NewJobSheet({
  open,
  properties,
  inspectors,
  onClose,
  onCreated,
}: {
  open: boolean;
  properties: AdminProperty[];
  inspectors: AdminUser[];
  onClose: () => void;
  onCreated: (message: string) => void;
}) {
  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [date, setDate] = useState(todayKey());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const active = properties.filter((p) => p.approval_status === "active");

  useEffect(() => {
    if (!open) return;
    setError("");
    setDate(todayKey());
    api<ServiceTemplate[]>("/api/templates").then((r) => {
      if (r.ok) setTemplates(r.data.filter((t) => !t.archived));
    });
  }, [open]);

  const pickProperty = (id: string) => {
    setPropertyId(id);
    setAssigneeId(properties.find((p) => p.id === id)?.assigned_inspector_id ?? "");
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    const res = await api("/api/jobs", {
      body: { property_id: propertyId, template_id: templateId, assignee_id: assigneeId || undefined, planned_at: date },
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setPropertyId("");
    setTemplateId("");
    onCreated("Обходът е създаден");
  };

  return (
    <Sheet open={open} onClose={onClose} placement="bottom" className="max-h-[90dvh] overflow-y-auto p-5">
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-ink">Нов обход</h3>
        <Field label="Имот">
          <select className={inputClass} value={propertyId} onChange={(e) => pickProperty(e.target.value)}>
            <option value="">— изберете —</option>
            {active.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.address}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Услуга (чеклист)">
          <select className={inputClass} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">— изберете —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Дата">
          <input type="date" className={inputClass} min={todayKey()} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Инспектор">
          <select className={inputClass} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">— невъзложен —</option>
            {inspectors.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
              </option>
            ))}
          </select>
        </Field>
        {error && <p className="rounded-card bg-state-danger/10 px-3 py-2 text-sm text-state-danger">{error}</p>}
        <div className="flex gap-2 pb-2">
          <Button variant="secondary" fullWidth onClick={onClose}>
            Отказ
          </Button>
          <Button fullWidth disabled={busy || !propertyId || !templateId || !date} onClick={submit}>
            Създай
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
