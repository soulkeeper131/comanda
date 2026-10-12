"use client";

import { useEffect, useState } from "react";
import AddressPicker from "@/components/AddressPicker";
import type { AddressHit } from "@/components/useAddressSearch";
import { Sheet } from "@/components/ui/Sheet";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { api } from "./api";
import { Field, inputClass } from "./ui";
import type { AdminUser } from "./types";

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
  const [picked, setPicked] = useState<AddressHit | null>(null);
  // Нов ключ при всяко отваряне — полето за адрес започва празно.
  const [round, setRound] = useState(0);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOwnerId("");
    setName("");
    setPicked(null);
    setRound((r) => r + 1);
    setContactName("");
    setContactPhone("");
    setNotes("");
    setError("");
  }, [open]);

  const submit = async () => {
    if (!picked) return;
    setBusy(true);
    setError("");
    const res = await api("/api/properties", {
      body: {
        owner_id: ownerId,
        name: name.trim() || picked.street || picked.label,
        city: picked.city || "София",
        address: picked.label,
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
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-ink">Нов имот</h3>
          <button onClick={onClose} className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-muted" aria-label="Затвори">
            <Icon name="x" size={22} />
          </button>
        </div>
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
        {/* Не в <label>: вътре има бутони (предложенията, „Смени“). */}
        <div>
          <span className="mb-1 block text-sm font-semibold text-ink-2">Адрес</span>
          <AddressPicker key={round} picked={picked} onPick={setPicked} />
        </div>
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
        {(!ownerId || !picked) && (
          <p className="text-xs text-muted">За да добавите, изберете клиент и адрес от предложенията.</p>
        )}
        <div className="sticky bottom-0 flex gap-2 bg-white pb-2 pt-2">
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
