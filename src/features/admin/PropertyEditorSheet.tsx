"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { api } from "./api";
import { Field, inputClass, ReasonSheet } from "./ui";
import type { AdminProperty, AdminUser } from "./types";

export const APPROVAL: Record<AdminProperty["approval_status"], { text: string; tone: "warning" | "ok" | "danger" }> = {
  pending: { text: "Чака одобрение", tone: "warning" },
  active: { text: "Одобрен", tone: "ok" },
  rejected: { text: "Отказан", tone: "danger" },
};

type Form = {
  name: string;
  city: string;
  address: string;
  lat: string;
  lng: string;
  geofence_m: string;
  contact_name: string;
  contact_phone: string;
  access_notes: string;
  assigned_inspector_id: string;
};

const toForm = (p: AdminProperty): Form => ({
  name: p.name,
  city: p.city ?? "",
  address: p.address ?? "",
  lat: String(p.lat),
  lng: String(p.lng),
  geofence_m: String(p.geofence_m ?? 75),
  contact_name: p.contact_name ?? "",
  contact_phone: p.contact_phone ?? "",
  access_notes: p.access_notes ?? "",
  assigned_inspector_id: p.assigned_inspector_id ?? "",
});

/**
 * Преглед и одобрение на имот (въпрос 24): тук се сверяват адресът и
 * координатите — иначе инспекторът отива на грешно място. Одобрението и
 * корекцията стават с едно натискане.
 */
export default function PropertyEditorSheet({
  property,
  inspectors,
  onClose,
  onChanged,
}: {
  property: AdminProperty | null;
  inspectors: AdminUser[];
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    setForm(property ? toForm(property) : null);
    setError("");
  }, [property]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

  const save = async (extra: Record<string, unknown> = {}, message = "Имотът е запазен") => {
    if (!property || !form) return;
    setBusy(true);
    setError("");
    const body: Record<string, unknown> = {
      name: form.name,
      city: form.city,
      address: form.address,
      lat: Number(form.lat),
      lng: Number(form.lng),
      geofence_m: Number(form.geofence_m),
      contact_name: form.contact_name,
      contact_phone: form.contact_phone,
      access_notes: form.access_notes,
      assigned_inspector_id: form.assigned_inspector_id || null,
      ...extra,
    };
    const res = await api(`/api/properties/${property.id}`, { method: "PATCH", body });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onChanged(message);
  };

  const mapUrl = form ? `https://www.openstreetmap.org/?mlat=${form.lat}&mlon=${form.lng}#map=18/${form.lat}/${form.lng}` : "#";
  const badge = property ? APPROVAL[property.approval_status] : null;

  return (
    <>
      <Sheet open={!!property && !rejecting} onClose={onClose} placement="bottom" className="max-h-[92dvh] overflow-y-auto p-5">
        {property && form && badge && (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-ink">{property.name}</h3>
                <p className="text-sm text-muted">
                  {property.owner_name}
                  {property.owner_email ? ` · ${property.owner_email}` : ""}
                </p>
                {property.owner_phone && (
                  <a href={`tel:${property.owner_phone}`} className="text-sm font-semibold text-brand-primary">
                    {property.owner_phone}
                  </a>
                )}
              </div>
              <Badge tone={badge.tone}>{badge.text}</Badge>
            </div>
            {property.approval_status === "rejected" && property.rejection_reason && (
              <p className="rounded-card bg-state-danger/10 px-3 py-2 text-sm text-state-danger">{property.rejection_reason}</p>
            )}

            <Field label="Име">
              <input className={inputClass} value={form.name} onChange={set("name")} />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Град">
                <input className={inputClass} value={form.city} onChange={set("city")} />
              </Field>
              <div className="col-span-2">
                <Field label="Адрес">
                  <input className={inputClass} value={form.address} onChange={set("address")} />
                </Field>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Ширина">
                <input className={inputClass} inputMode="decimal" value={form.lat} onChange={set("lat")} />
              </Field>
              <Field label="Дължина">
                <input className={inputClass} inputMode="decimal" value={form.lng} onChange={set("lng")} />
              </Field>
              <Field label="Периметър (м)">
                <input className={inputClass} inputMode="numeric" value={form.geofence_m} onChange={set("geofence_m")} />
              </Field>
            </div>
            <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary">
              <Icon name="pin" size={16} /> Провери точката на картата
            </a>

            <Field label="Инспектор на имота" hint="Важи за новите обходи; вече създадените не се пренаписват.">
              <select className={inputClass} value={form.assigned_inspector_id} onChange={set("assigned_inspector_id")}>
                <option value="">— без инспектор —</option>
                {inspectors.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Контакт за достъп">
                <input className={inputClass} value={form.contact_name} onChange={set("contact_name")} />
              </Field>
              <Field label="Телефон">
                <input className={inputClass} type="tel" value={form.contact_phone} onChange={set("contact_phone")} />
              </Field>
            </div>
            <Field label="Бележки за достъп">
              <textarea className={`${inputClass} min-h-[72px] py-2`} value={form.access_notes} onChange={set("access_notes")} />
            </Field>

            {error && <p className="rounded-card bg-state-danger/10 px-3 py-2 text-sm text-state-danger">{error}</p>}

            <div className="flex flex-wrap gap-2 pb-2">
              {property.approval_status !== "active" && (
                <Button disabled={busy} onClick={() => save({ status: "active" }, "Имотът е одобрен — клиентът е уведомен")}>
                  <Icon name="check" size={16} /> Одобри
                </Button>
              )}
              {property.approval_status === "active" && (
                <Button disabled={busy} onClick={() => save()}>
                  Запази
                </Button>
              )}
              {property.approval_status === "pending" && (
                <>
                  <Button variant="secondary" disabled={busy} onClick={() => save()}>
                    Само запази
                  </Button>
                  <Button variant="ghost" disabled={busy} onClick={() => setRejecting(true)}>
                    Откажи
                  </Button>
                </>
              )}
              {property.approval_status === "active" && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    if (confirm("Архивиране: имотът изчезва от списъците. Продължавам?")) {
                      save({ archived: true }, "Имотът е архивиран");
                    }
                  }}
                >
                  Архивирай
                </Button>
              )}
              <Button variant="ghost" className="ml-auto" onClick={onClose}>
                Затвори
              </Button>
            </div>
          </div>
        )}
      </Sheet>
      <ReasonSheet
        open={rejecting}
        title="Отказ на имота"
        description="Клиентът ще получи причината по имейл и в приложението."
        confirmLabel="Откажи имота"
        danger
        onClose={() => setRejecting(false)}
        onConfirm={async (reason) => {
          setRejecting(false);
          await save({ status: "rejected", rejection_reason: reason }, "Имотът е отказан");
        }}
      />
    </>
  );
}
