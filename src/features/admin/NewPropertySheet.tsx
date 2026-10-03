"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { api } from "./api";
import { Field, inputClass } from "./ui";
import type { AdminUser } from "./types";

type Hit = { lat: number; lng: number; label: string; display_name: string };

/**
 * Админът добавя имот от името на клиент (напр. след телефонен разговор).
 * Собственикът е задължителен и трябва да е клиент — той решава по
 * офертите. Имотът е одобрен веднага: админът сам проверява адреса.
 */
export default function NewPropertySheet({
  open,
  clients,
  onClose,
  onCreated,
}: {
  open: boolean;
  clients: AdminUser[];
  onClose: () => void;
  onCreated: (message: string) => void;
}) {
  const [ownerId, setOwnerId] = useState("");
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [picked, setPicked] = useState<Hit | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOwnerId("");
    setName("");
    setQuery("");
    setHits([]);
    setPicked(null);
    setContactName("");
    setContactPhone("");
    setNotes("");
    setError("");
  }, [open]);

  useEffect(() => {
    if (picked || query.trim().length < 3) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await api<{ results: Hit[] }>(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
      setHits(r.ok ? r.data.results : []);
    }, 450);
    return () => clearTimeout(t);
  }, [query, picked]);

  const submit = async () => {
    if (!picked) return;
    setBusy(true);
    setError("");
    const parts = picked.label.split(",").map((s) => s.trim());
    const city = parts.length > 1 ? parts[parts.length - 1] : "София";
    const res = await api("/api/properties", {
      body: {
        owner_id: ownerId,
        name: name.trim() || parts[0],
        city,
        address: parts.length > 1 ? parts.slice(0, -1).join(", ") : picked.label,
        lat: picked.lat,
        lng: picked.lng,
        contact_name: contactName,
        contact_phone: contactPhone,
        access_notes: notes,
      },
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onCreated("Имотът е добавен и одобрен");
  };

  return (
    <Sheet open={open} onClose={onClose} placement="bottom" className="max-h-[92dvh] overflow-y-auto p-5">
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-ink">Нов имот</h3>
        <Field label="Собственик (клиент)">
          <select className={inputClass} value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            <option value="">— изберете клиент —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.email} · {c.email}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Адрес" hint="Започнете да пишете и изберете от предложенията.">
          <input
            className={inputClass}
            value={picked ? picked.label : query}
            onChange={(e) => {
              setPicked(null);
              setQuery(e.target.value);
            }}
            placeholder="ул. Оборище 45, София"
          />
        </Field>
        {hits.length > 0 && (
          <div className="overflow-hidden rounded-card border border-line">
            {hits.map((h) => (
              <button
                key={`${h.lat},${h.lng}`}
                onClick={() => {
                  setPicked(h);
                  setHits([]);
                }}
                className="block w-full border-b border-line px-3 py-2.5 text-left text-sm last:border-0 hover:bg-brand-bg"
              >
                <div className="font-semibold text-ink">{h.label}</div>
                <div className="truncate text-xs text-muted">{h.display_name}</div>
              </button>
            ))}
          </div>
        )}
        <Field label="Име на имота (по желание)">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Апартамент Лозенец" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Контакт за достъп">
            <input className={inputClass} value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </Field>
          <Field label="Телефон">
            <input className={inputClass} type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </Field>
        </div>
        <Field label="Бележки за достъп">
          <textarea className={`${inputClass} min-h-[72px] py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {clients.length === 0 && (
          <p className="text-sm text-state-warning">Няма клиенти. Създайте клиентски акаунт от Настройки → Екип.</p>
        )}
        {error && <p className="rounded-card bg-state-danger/10 px-3 py-2 text-sm text-state-danger">{error}</p>}
        <div className="flex gap-2 pb-2">
          <Button variant="secondary" fullWidth onClick={onClose}>
            Отказ
          </Button>
          <Button fullWidth disabled={busy || !ownerId || !picked} onClick={submit}>
            Добави
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
