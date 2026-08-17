"use client";

import { useState, useEffect } from "react";
import { Sheet } from "./ui/Sheet";
import { Button } from "./ui/Button";
import { Input, Select, Textarea } from "./ui/Input";

type AddressHit = {
  lat: number;
  lng: number;
  label: string;
  display_name: string;
};

type PropertyFormData = {
  name: string;
  city: string;
  addr: string;
  type: string;
  access: string;
  lat?: number;
  lng?: number;
};

export default function PropertyForm({ onAdd, onClose }: { onAdd: (data: PropertyFormData) => void; onClose: () => void }) {
  const [data, setData] = useState<PropertyFormData>({ name: "", city: "", addr: "", type: "apartment", access: "" });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.name.trim() || !picked) return;
    onAdd(data);
    onClose();
  };

  return (
    <Sheet open onClose={onClose} placement="center">
      <h3 className="text-lg font-bold mb-4 text-brand-dark">＋ Нов обект</h3>
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
        <Textarea
          placeholder="Достъп (ключове, кодове, бележки)"
          value={data.access}
          onChange={(e) => setData({ ...data, access: e.target.value })}
          rows={2}
        />
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>Отказ</Button>
          <Button type="submit" variant="primary" fullWidth>Добави</Button>
        </div>
      </form>
    </Sheet>
  );
}
