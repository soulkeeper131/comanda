"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "./Section";
import { api } from "./api";
import type { ApprovalStatus, ClientProperty } from "./types";
import { fullAddress } from "@/lib/format";
import PropertyForm, { type PropertyFormData } from "@/components/PropertyForm";

export const APPROVAL: Record<ApprovalStatus, { text: string; tone: "ok" | "warning" | "danger" }> = {
  pending: { text: "Чака одобрение", tone: "warning" },
  active: { text: "Одобрен", tone: "ok" },
  rejected: { text: "Отказан", tone: "danger" },
};

export default function PropertyHeader({
  property,
  onBack,
  onSaved,
}: {
  property: ClientProperty;
  onBack?: () => void;
  onSaved: (msg: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const canFix = property.approval_status === "pending" || property.approval_status === "rejected";

  const saveFix = async (d: PropertyFormData): Promise<string | void> => {
    const res = await api(`/api/properties/${property.id}`, {
      method: "PATCH",
      body: { name: d.name, city: d.city, address: d.addr, kind: d.type, lat: d.lat, lng: d.lng },
    });
    if (!res.ok) return res.error;
    setFixing(false);
    onSaved(property.approval_status === "rejected" ? "Имотът е изпратен отново за одобрение." : "Адресът е поправен.");
  };

  const remove = async () => {
    setRemoveError("");
    const res = await api(`/api/properties/${property.id}`, { method: "PATCH", body: { archived: true } });
    if (!res.ok) return setRemoveError(res.error);
    setRemoving(false);
    onSaved("Имотът е премахнат.");
  };
  const approval = APPROVAL[property.approval_status] ?? APPROVAL.pending;

  return (
    <div className="space-y-3">
      {onBack && (
        <button onClick={onBack} className="flex min-h-touch items-center gap-1 text-sm font-semibold text-brand-primary">
          <Icon name="chevron-left" size={18} />
          Всички имоти
        </button>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-ink">{property.name}</h1>
          <p className="flex items-center gap-1 text-sm text-muted">
            <Icon name="pin" size={14} />
            <span className="truncate">{fullAddress(property.city, property.address)}</span>
          </p>
        </div>
        {property.approval_status !== "active" && (
          <Badge tone={approval.tone} className="shrink-0">
            {approval.text}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" className="min-h-touch" onClick={() => setEditing(true)}>
          <Icon name="edit" size={16} />
          Данни за достъп
        </Button>
        {canFix && (
          <Button variant="secondary" size="sm" className="min-h-touch" onClick={() => setFixing(true)}>
            <Icon name="pin" size={16} />
            {property.approval_status === "rejected" ? "Поправи и изпрати отново" : "Поправи адреса"}
          </Button>
        )}
        {property.approval_status !== "active" && (
          <Button variant="ghost" size="sm" className="min-h-touch text-state-danger" onClick={() => setRemoving(true)}>
            <Icon name="trash" size={16} />
            Премахни
          </Button>
        )}
      </div>

      {property.approval_status === "pending" && (
        <Notice tone="warning">
          <strong>Имотът чака одобрение.</strong> Ще проверим адреса и ще ви се обадим. След одобрението ще можете
          да изберете пакет.
        </Notice>
      )}
      {property.approval_status === "rejected" && (
        <Notice tone="danger">
          <strong>Имотът не е одобрен.</strong>
          {property.rejection_reason ? ` Причина: ${property.rejection_reason}` : ""}
        </Notice>
      )}

      {fixing && (
        <PropertyForm
          title={property.approval_status === "rejected" ? "Поправка и ново одобрение" : "Поправка на адреса"}
          submitLabel={property.approval_status === "rejected" ? "Изпрати отново" : "Запази"}
          initial={{
            name: property.name,
            city: property.city ?? "",
            addr: property.address ?? "",
            type: property.kind ?? "apartment",
            access: property.access_notes ?? "",
            contact_name: property.contact_name ?? "",
            contact_phone: property.contact_phone ?? "",
            lat: property.lat ?? undefined,
            lng: property.lng ?? undefined,
          }}
          onAdd={saveFix}
          onClose={() => setFixing(false)}
        />
      )}

      <Sheet open={removing} onClose={() => setRemoving(false)} placement="bottom" className="mx-auto max-w-lg p-5">
        <h3 className="text-lg font-bold text-ink">Премахване на имота?</h3>
        <p className="mt-2 text-sm text-muted">Имотът ще изчезне от профила ви. Можете да добавите нов по всяко време.</p>
        {removeError && (
          <div className="mt-3">
            <Notice tone="danger">{removeError}</Notice>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" fullWidth onClick={() => setRemoving(false)}>
            Откажи
          </Button>
          <Button variant="danger" fullWidth onClick={remove}>
            Премахни
          </Button>
        </div>
      </Sheet>

      {editing && (
        <AccessSheet
          property={property}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onSaved("Данните за достъп са запазени.");
          }}
        />
      )}
    </div>
  );
}

function AccessSheet({
  property,
  onClose,
  onSaved,
}: {
  property: ClientProperty;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [contactName, setContactName] = useState(property.contact_name ?? "");
  const [contactPhone, setContactPhone] = useState(property.contact_phone ?? "");
  const [notes, setNotes] = useState(property.access_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await api(`/api/properties/${property.id}`, {
      method: "PATCH",
      body: {
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
        access_notes: notes.trim(),
      },
    });
    setSaving(false);
    if (res.ok) onSaved();
    else setError(res.error);
  };

  return (
    <Sheet open onClose={onClose} placement="bottom" className="mx-auto max-h-[90dvh] max-w-lg overflow-y-auto p-5">
      <h3 className="text-lg font-bold text-ink">Данни за достъп</h3>
      <p className="mt-1 text-sm text-muted">
        На кого да се обади инспекторът на място и как се влиза в имота.
      </p>
      <form onSubmit={save} className="mt-4 space-y-3">
        <label className="block text-sm font-semibold text-ink">
          Контакт за достъп (име)
          <Input
            className="mt-1"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Напр. съсед, домоуправител"
            autoComplete="name"
          />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Телефон
          <Input
            className="mt-1"
            type="tel"
            inputMode="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="08X XXX XXXX"
            autoComplete="tel"
          />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Бележки за достъп
          <Textarea
            className="mt-1"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ключове, код на входа, етаж…"
          />
        </label>
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>
            Отказ
          </Button>
          <Button type="submit" fullWidth disabled={saving}>
            {saving ? "Запазване…" : "Запази"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
