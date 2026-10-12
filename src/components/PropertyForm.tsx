"use client";

import { useState } from "react";
import { Sheet } from "./ui/Sheet";
import { Button } from "./ui/Button";
import { Input, Select, Textarea } from "./ui/Input";
import { Icon } from "./ui/Icon";
import AddressPicker from "./AddressPicker";
import type { AddressHit } from "./useAddressSearch";

export type PropertyFormData = {
  name: string;
  city: string;
  addr: string;
  type: string;
  access: string;
  /** Кого да търси инспекторът на място (въпрос 27) */
  contact_name: string;
  contact_phone: string;
  lat?: number;
  lng?: number;
};

/**
 * onAdd може да върне съобщение за грешка — тогава формата остава отворена
 * и го показва; иначе се затваря.
 */
export default function PropertyForm({
  onAdd,
  onClose,
  initial,
  title = "Нов имот",
  submitLabel = "Добави",
}: {
  onAdd: (data: PropertyFormData) => void | string | Promise<void | string>;
  onClose: () => void;
  /** Попълнена форма — за поправка на имот, който чака или е отказан. */
  initial?: PropertyFormData;
  title?: string;
  submitLabel?: string;
}) {
  const [data, setData] = useState<PropertyFormData>(
    initial ?? {
      name: "",
      city: "",
      addr: "",
      type: "apartment",
      access: "",
      contact_name: "",
      contact_phone: "",
    },
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  // Имот за поправка идва с координати — адресът му е вече избран.
  const [picked, setPicked] = useState<AddressHit | null>(
    initial?.lat && initial?.lng
      ? { lat: initial.lat, lng: initial.lng, label: initial.addr, display_name: initial.addr, street: initial.addr, city: initial.city, precise: true }
      : null,
  );

  const pickAddress = (hit: AddressHit | null) => {
    setPicked(hit);
    setSubmitError("");
    setData((prev) =>
      hit
        ? { ...prev, addr: hit.label, city: hit.city || prev.city || "София", lat: hit.lat, lng: hit.lng }
        : { ...prev, addr: "", lat: undefined, lng: undefined },
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.name.trim()) return;
    if (!picked) {
      setSubmitError("Изберете адреса от предложенията.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    const err = await onAdd({
      ...data,
      name: data.name.trim(),
      access: data.access.trim(),
      contact_name: data.contact_name.trim(),
      contact_phone: data.contact_phone.trim(),
    });
    setSubmitting(false);
    if (typeof err === "string" && err) {
      setSubmitError(err);
      return;
    }
    onClose();
  };

  return (
    <Sheet open onClose={onClose} placement="center">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-lg font-bold text-brand-dark">
          <Icon name={initial ? "edit" : "plus"} size={20} />
          {title}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-brand-bg"
          aria-label="Затвори"
        >
          <Icon name="x" size={22} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          type="text"
          placeholder="Име на имота"
          value={data.name}
          onChange={(e) => setData({ ...data, name: e.target.value })}
          required
        />
        <AddressPicker picked={picked} onPick={pickAddress} initialQuery={initial?.addr} />
        <Select
          value={data.type}
          onChange={(e) => setData({ ...data, type: e.target.value })}
          className="text-brand-dark"
        >
          <option value="apartment">Апартамент</option>
          <option value="house">Къща</option>
          <option value="studio">Студио</option>
          <option value="villa">Вила</option>
        </Select>
        <p className="pt-1 text-sm font-semibold text-ink">
          Достъп <span className="font-normal text-muted">(по желание)</span>
        </p>
        <Input
          type="text"
          placeholder="Контакт за достъп (име)"
          aria-label="Контакт за достъп (име)"
          value={data.contact_name}
          onChange={(e) => setData({ ...data, contact_name: e.target.value })}
          autoComplete="name"
        />
        <Input
          type="tel"
          inputMode="tel"
          placeholder="Телефон"
          aria-label="Телефон"
          value={data.contact_phone}
          onChange={(e) => setData({ ...data, contact_phone: e.target.value })}
          autoComplete="tel"
        />
        <Textarea
          placeholder="Бележки за достъп (ключове, код на входа, етаж)"
          aria-label="Бележки за достъп"
          value={data.access}
          onChange={(e) => setData({ ...data, access: e.target.value })}
          rows={2}
        />
        {submitError && (
          <p className="rounded-card bg-state-danger/10 px-3 py-2 text-sm text-state-danger">{submitError}</p>
        )}
        <div className="sticky bottom-0 -mx-1 flex gap-2 bg-white px-1 pb-1 pt-3">
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>Отказ</Button>
          <Button type="submit" variant="primary" fullWidth disabled={submitting}>
            {submitting ? "Запазване…" : submitLabel}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
