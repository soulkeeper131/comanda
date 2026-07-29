"use client";

import { useState } from "react";

type PropertyFormData = {
  name: string;
  addr: string;
  type: string;
  access: string;
  lat?: number;
  lng?: number;
};

export default function PropertyForm({ onAdd, onClose }: { onAdd: (data: PropertyFormData) => void; onClose: () => void }) {
  const [data, setData] = useState<PropertyFormData>({ name: "", addr: "", type: "apartment", access: "" });
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [geocodeResult, setGeocodeResult] = useState<{ display_name: string; lat: number; lng: number } | null>(null);
  const [geocodeError, setGeocodeError] = useState("");

  const handleGeocode = async () => {
    if (!data.addr.trim()) return;
    setGeocodeLoading(true);
    setGeocodeError("");
    setGeocodeResult(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(data.addr)}`);
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
    if (!data.name.trim() || !data.addr.trim()) return;
    onAdd(data);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-x-4 bottom-1/2 translate-y-1/2 z-50 max-w-md mx-auto bg-white rounded-2xl shadow-2xl p-6">
        <h3 className="text-lg font-bold mb-4" style={{ color: "#006494" }}>＋ Нов обект</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Име на имота"
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border text-base"
            style={{ borderColor: "#e4e9f0", fontSize: 16 }}
            required
          />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Адрес"
              value={data.addr}
              onChange={(e) => setData({ ...data, addr: e.target.value })}
              className="flex-1 px-4 py-3 rounded-xl border text-base"
              style={{ borderColor: "#e4e9f0", fontSize: 16 }}
              required
            />
            <button
              type="button"
              onClick={handleGeocode}
              disabled={geocodeLoading}
              className="min-h-[44px] min-w-[44px] px-3 py-3 rounded-xl text-sm font-semibold border flex items-center justify-center transition"
              style={{
                borderColor: geocodeError ? "#fecaca" : geocodeResult ? "#bbf7d0" : "#d0e5ff",
                color: geocodeError ? "#dc2626" : geocodeResult ? "#16a34a" : "#1b98e0",
                background: geocodeError ? "#fef2f2" : geocodeResult ? "#f0fdf4" : "#eff6ff",
              }}
            >
              {geocodeLoading ? "⏳" : geocodeResult ? "✓" : "📍 Геокодирай"}
            </button>
          </div>
          {geocodeResult && (
            <p className="text-xs font-medium" style={{ color: "#16a34a" }}>
              ✓ {geocodeResult.display_name} ({geocodeResult.lat.toFixed(4)}, {geocodeResult.lng.toFixed(4)})
            </p>
          )}
          {geocodeError && (
            <p className="text-xs font-medium" style={{ color: "#dc2626" }}>{geocodeError}</p>
          )}
          <select
            value={data.type}
            onChange={(e) => setData({ ...data, type: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border text-base"
            style={{ borderColor: "#e4e9f0", fontSize: 16, color: "#006494" }}
          >
            <option value="apartment">Апартамент</option>
            <option value="house">Къща</option>
            <option value="studio">Студио</option>
            <option value="villa">Вила</option>
          </select>
          <textarea
            placeholder="Достъп (ключове, кодове, бележки)"
            value={data.access}
            onChange={(e) => setData({ ...data, access: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border text-base resize-none"
            style={{ borderColor: "#e4e9f0", fontSize: 16, minHeight: 80 }}
            rows={2}
          />
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold border"
              style={{ borderColor: "#d0e5ff", color: "#247ba0" }}>
              Отказ
            </button>
            <button type="submit" className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(140deg, #1b98e0, #006494)" }}>
              Добави
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
