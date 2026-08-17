"use client";

import { useState } from "react";
import { Sheet } from "./ui/Sheet";
import { Button } from "./ui/Button";
import { Input, Select, Textarea } from "./ui/Input";

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
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [geocodeResult, setGeocodeResult] = useState<{ display_name: string; lat: number; lng: number } | null>(null);
  const [geocodeError, setGeocodeError] = useState("");

  const handleGeocode = async () => {
    const q = [data.city, data.addr].filter(Boolean).join(", ");
    if (!q.trim()) return;
    setGeocodeLoading(true);
    setGeocodeError("");
    setGeocodeResult(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const json = await res.json();
        setGeocodeResult(json);
        setData(prev => ({ ...prev, lat: json.lat, lng: json.lng }));
      } else {
        setGeocodeError("Адресът не е намерен");
        setData(prev => ({ ...prev, lat: undefined, lng: undefined }));
      }
    } catch {
      setGeocodeError("Адресът не е намерен");
      setData(prev => ({ ...prev, lat: undefined, lng: undefined }));
    }
    setGeocodeLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.name.trim() || !data.city.trim() || !data.addr.trim()) return;
    onAdd(data);
    onClose();
  };

  const geocodeTone = geocodeError ? "danger" : geocodeResult ? "ok" : "info";
  const geocodeToneClasses: Record<string, string> = {
    danger: "border-state-danger/30 text-state-danger bg-state-danger/5",
    ok: "border-state-ok/30 text-state-ok bg-state-ok/5",
    info: "border-brand-primary/20 text-brand-primary bg-brand-primary/5",
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
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Град"
            value={data.city}
            onChange={(e) => setData({ ...data, city: e.target.value })}
            className="flex-1"
            required
          />
          <Input
            type="text"
            placeholder="Адрес"
            value={data.addr}
            onChange={(e) => setData({ ...data, addr: e.target.value })}
            className="flex-1"
            required
          />
          <button
            type="button"
            onClick={handleGeocode}
            disabled={geocodeLoading}
            className={[
              "min-h-touch min-w-touch px-3 py-3 rounded-xl text-sm font-semibold border",
              "flex items-center justify-center transition-colors disabled:opacity-50",
              geocodeToneClasses[geocodeTone],
            ].join(" ")}
          >
            {geocodeLoading ? "⏳" : geocodeResult ? "✓" : "📍 Геокодирай"}
          </button>
        </div>
        {geocodeResult && (
          <p className="text-xs font-medium text-state-ok">
            ✓ {geocodeResult.display_name} ({geocodeResult.lat.toFixed(4)}, {geocodeResult.lng.toFixed(4)})
          </p>
        )}
        {geocodeError && (
          <p className="text-xs font-medium text-state-danger">{geocodeError}</p>
        )}
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
