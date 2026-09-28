"use client";

import { useState, useEffect } from "react";
import { Sheet } from "./ui/Sheet";
import { Button } from "./ui/Button";
import { Input, Select, Textarea } from "./ui/Input";
import { Icon } from "./ui/Icon";

type AddressHit = {
  lat: number;
  lng: number;
  label: string;
  display_name: string;
};

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
}: {
  onAdd: (data: PropertyFormData) => void | string | Promise<void | string>;
  onClose: () => void;
}) {
  const [data, setData] = useState<PropertyFormData>({
    name: "",
    city: "",
    addr: "",
    type: "apartment",
    access: "",
    contact_name: "",
    contact_phone: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AddressHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<AddressHit | null>(null);
  const [searchError, setSearchError] = useState("");

  // Търси докато потребителят пише, но изчаква да спре — иначе всяка буква
  // праща заявка към Nominatim.
  useEffect(() => {
    if (picked) return;

    const q = query.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setSearchError("");
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError("");
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (!res.ok) {
          setSearchError(json.error ?? "Търсенето не успя");
          setSuggestions([]);
        } else {
          setSuggestions(json.results ?? []);
          if ((json.results ?? []).length === 0) {
            setSearchError("Няма намерени адреси. Опитайте с по-малко детайли.");
          }
        }
      } catch {
        setSearchError("Търсенето не успя. Проверете връзката.");
        setSuggestions([]);
      }
      setSearching(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [query, picked]);

  const pickAddress = (hit: AddressHit) => {
    setPicked(hit);
    setQuery(hit.label);
    setSuggestions([]);
    setSearchError("");

    const a = hit.display_name.split(",").map((s) => s.trim());
    setData((prev) => ({
      ...prev,
      addr: hit.label,
      // Градът е предпоследната смислена част от пълния адрес.
      city: prev.city || a.find((part) => /софия|пловдив|варна|бургас/i.test(part)) || a[a.length - 3] || prev.city,
      lat: hit.lat,
      lng: hit.lng,
    }));
  };

  const clearAddress = () => {
    setPicked(null);
    setQuery("");
    setData((prev) => ({ ...prev, addr: "", lat: undefined, lng: undefined }));
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
    <Sheet open onClose={onClose} placement="center" className="max-h-[90dvh] overflow-y-auto">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-brand-dark">
        <Icon name="plus" size={20} />
        Нов имот
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          type="text"
          placeholder="Име на имота"
          value={data.name}
          onChange={(e) => setData({ ...data, name: e.target.value })}
          required
        />
        <div className="relative">
          <Input
            type="text"
            placeholder="Започнете да пишете адреса…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (picked) setPicked(null);
            }}
            autoComplete="off"
            required
          />

          {picked && (
            <div className="mt-1 flex items-start gap-2 text-xs text-state-ok">
              <span className="font-semibold">Избран адрес:</span>
              <span className="flex-1">{picked.display_name}</span>
              <button
                type="button"
                onClick={clearAddress}
                className="font-semibold text-muted underline underline-offset-2"
              >
                смени
              </button>
            </div>
          )}

          {!picked && searching && (
            <p className="mt-1 text-xs text-muted">Търси…</p>
          )}

          {!picked && suggestions.length > 0 && (
            <ul
              className="absolute z-10 mt-1 w-full overflow-hidden rounded-card border border-line bg-white shadow-card-2"
              role="listbox"
            >
              {suggestions.map((hit, i) => (
                <li key={`${hit.lat}-${hit.lng}-${i}`}>
                  <button
                    type="button"
                    onClick={() => pickAddress(hit)}
                    className="min-h-touch w-full px-3 py-2 text-left hover:bg-brand-bg"
                  >
                    <span className="block text-sm font-medium text-ink">{hit.label}</span>
                    <span className="block truncate text-xs text-muted">{hit.display_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!picked && searchError && (
            <p className="mt-1 text-xs font-medium text-state-danger">{searchError}</p>
          )}
        </div>
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
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>Отказ</Button>
          <Button type="submit" variant="primary" fullWidth disabled={submitting}>
            {submitting ? "Запазване…" : "Добави"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
