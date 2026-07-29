"use client";

import { useState } from "react";

type ChecklistItem = {
  id: string;
  label: string;
  zone: string;
  required: boolean;
  proofType: "photo" | "note" | "none";
  done: boolean;
};

type Zone = {
  name: string;
  icon: string;
};

type Props = {
  propertyName: string;
  propertyAddr: string;
  onClose: () => void;
  onComplete: (data: { items: ChecklistItem[]; gps: { lat: number; lng: number } | null }) => void;
};

const ZONES: Record<string, Zone> = {
  entrance: { name: "Антре", icon: "🚪" },
  living: { name: "Дневна", icon: "🛋️" },
  kitchen: { name: "Кухня", icon: "🍳" },
  bath: { name: "Баня", icon: "🚿" },
  bedroom: { name: "Спалня", icon: "🛏️" },
  terrace: { name: "Тераса", icon: "🌿" },
  basement: { name: "Мазе/Таван", icon: "📦" },
  exterior: { name: "Външна част", icon: "🏡" },
};

const DEFAULT_ITEMS: ChecklistItem[] = [
  // Антре
  { id: "e1", label: "Проверка на вратата — заключва ли се?", zone: "entrance", required: true, proofType: "photo", done: false },
  { id: "e2", label: "Проверка на осветлението в антрето", zone: "entrance", required: false, proofType: "note", done: false },
  // Дневна
  { id: "l1", label: "Проветряване на дневната (10 мин)", zone: "living", required: true, proofType: "photo", done: false },
  { id: "l2", label: "Проверка за влага по стените и тавана", zone: "living", required: true, proofType: "photo", done: false },
  { id: "l3", label: "Проверка на прозорците — затворени?", zone: "living", required: true, proofType: "photo", done: false },
  { id: "l4", label: "Проверка на радиаторите", zone: "living", required: false, proofType: "note", done: false },
  // Кухня
  { id: "k1", label: "Пускане на водата — сифоните да не изсъхнат", zone: "kitchen", required: true, proofType: "photo", done: false },
  { id: "k2", label: "Проверка за течове под мивката", zone: "kitchen", required: true, proofType: "photo", done: false },
  { id: "k3", label: "Проверка на хладилника (изключен?)", zone: "kitchen", required: false, proofType: "photo", done: false },
  // Баня
  { id: "b1", label: "Пускане на водата в банята", zone: "bath", required: true, proofType: "photo", done: false },
  { id: "b2", label: "Проверка за течове около тоалетна/душ", zone: "bath", required: true, proofType: "photo", done: false },
  { id: "b3", label: "Пускане на абсорбатора", zone: "bath", required: false, proofType: "note", done: false },
  // Спалня
  { id: "s1", label: "Проветряване на спалнята", zone: "bedroom", required: true, proofType: "photo", done: false },
  { id: "s2", label: "Проверка на прозорците", zone: "bedroom", required: true, proofType: "photo", done: false },
  // Тераса
  { id: "t1", label: "Проверка на терасата", zone: "terrace", required: false, proofType: "photo", done: false },
  { id: "t2", label: "Проверка на улуците", zone: "terrace", required: false, proofType: "photo", done: false },
];

export default function ChecklistSheet({ propertyName, propertyAddr, onClose, onComplete }: Props) {
  const [items, setItems] = useState<ChecklistItem[]>(DEFAULT_ITEMS.map(i => ({ ...i })));
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [photos, setPhotos] = useState<Record<string, string[]>>({});
  const [showPhotoMenu, setShowPhotoMenu] = useState<string | null>(null);
  const [viewerPhoto, setViewerPhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);

  const done = items.filter(i => i.done).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, done: !i.done } : i));
  };

  const getGPS = () => {
    if (!navigator.geolocation) {
      setGpsError("GPS не се поддържа от устройството");
      return;
    }
    setGpsLoading(true);
    setGpsError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLoading(false);
      },
      (err) => {
        setGpsError("GPS отказан или недостъпен");
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const addPhoto = async (itemId: string, file: File) => {
    setUploadingPhoto(itemId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const json = await res.json();
        const serverUrl = json.url;
        setPhotos(prev => ({
          ...prev,
          [itemId]: [...(prev[itemId] || []), serverUrl],
        }));
      }
    } catch {
      // silently ignore upload errors
    }
    setUploadingPhoto(null);
    setShowPhotoMenu(null);
  };

  const handleFileInput = (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) addPhoto(itemId, file);
  };

  // Group items by zone
  const zones = [...new Set(items.map(i => i.zone))];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.3)" }} onClick={onClose} />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl flex flex-col"
        style={{
          background: "#fff",
          maxHeight: "90dvh",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.12)",
        }}>
        {/* Grip */}
        <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "#d8dee6" }} />
        </div>

        {/* Header */}
        <div className="flex items-start gap-3 px-4 py-3 border-b flex-shrink-0" style={{ borderColor: "#e4e9f0" }}>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold" style={{ color: "#006494" }}>{propertyName}</h3>
            <p className="text-xs mt-0.5 truncate" style={{ color: "#247ba0" }}>{propertyAddr}</p>
            <div className="flex items-center gap-3 mt-2">
              {/* GPS */}
              {gps ? (
                <span className="text-xs font-semibold" style={{ color: "#16a34a" }}>
                  📍 {gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}
                </span>
              ) : (
                <button
                  onClick={getGPS}
                  disabled={gpsLoading}
                  className="text-xs font-semibold min-h-[44px] min-w-[44px] px-3 py-2.5 rounded-lg border"
                  style={{ borderColor: gpsError ? "#fecaca" : "#d0e5ff", color: gpsError ? "#dc2626" : "#1b98e0" }}
                >
                  {gpsLoading ? "📍 Търси..." : gpsError || "📍 Потвърди локация"}
                </button>
              )}
            </div>
          </div>
          <button onClick={onClose} className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "#f1f5f9", color: "#64748b", fontSize: 15 }}>✕</button>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 mx-4 mt-3 rounded-full overflow-hidden flex-shrink-0" style={{ background: "#e4e9f0" }}>
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, background: "linear-gradient(90deg, #1b98e0, #006494)" }} />
        </div>
        <div className="text-center text-xs py-1 flex-shrink-0" style={{ color: "#247ba0" }}>
          {done}/{total} точки ({pct}%)
        </div>

        {/* Body - scrollable */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {zones.map(zoneKey => {
            const zone = ZONES[zoneKey] || { name: zoneKey, icon: "📌" };
            const zoneItems = items.filter(i => i.zone === zoneKey);
            const zoneDone = zoneItems.filter(i => i.done).length;

            return (
              <div key={zoneKey} className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">{zone.icon}</span>
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#64748b" }}>
                    {zone.name}
                  </span>
                  <span className="ml-auto text-xs font-semibold" style={{ color: "#247ba0" }}>
                    {zoneDone}/{zoneItems.length}
                  </span>
                </div>

                {zoneItems.map(item => (
                  <div key={item.id}
                    className={`flex gap-3 p-3 rounded-xl border mb-2 transition cursor-pointer ${
                      item.done ? "bg-blue-50/50 border-blue-100" : "bg-white border-gray-100"
                    }`}
                    style={{ borderColor: item.done ? "#c9ddf0" : "#e4e9f0" }}
                    onClick={() => toggleItem(item.id)}>
                    {/* Checkbox */}
                    <div
                      className={`w-6 h-6 rounded-lg border-2 flex-shrink-0 mt-0.5 flex items-center justify-center text-white text-xs transition ${
                        item.done ? "bg-green-500 border-green-500" : "bg-white border-gray-300"
                      }`}>
                      {item.done && "✓"}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium leading-snug ${item.done ? "line-through" : ""}`}
                        style={{ color: item.done ? "#94a3b8" : "#1e293b" }}>
                        {item.label}
                      </div>

                      {item.required && (
                        <span className="inline-block mt-1.5 text-xs font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: "#fffbeb", color: "#b45309" }}>Задължително</span>
                      )}

                      {/* Photos */}
                      {(photos[item.id]?.length || 0) > 0 && (
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {photos[item.id]?.map((url, idx) => (
                            <img
                              key={idx}
                              src={url}
                              alt={`${idx + 1}`}
                              className="w-14 h-14 rounded-lg object-cover border cursor-pointer"
                              style={{ borderColor: "#e4e9f0" }}
                              onClick={(e) => { e.stopPropagation(); setViewerPhoto(url); }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Camera button */}
                      {item.proofType === "photo" && (
                        <div className="relative inline-block mt-2" onClick={(e) => e.stopPropagation()}>
                          {uploadingPhoto === item.id ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-lg text-xs font-semibold"
                              style={{ color: "#1b98e0", background: "#eff6ff" }}>
                              ⏳ Качване...
                            </span>
                          ) : (
                            <button
                              onClick={(ev) => { ev.stopPropagation(); setShowPhotoMenu(showPhotoMenu === item.id ? null : item.id); }}
                              className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-lg text-xs font-semibold border"
                              style={{ borderColor: "#c9ddf0", color: "#1b98e0", background: "#eff6ff" }}>
                              📷 Снимка
                            </button>
                          )}
                          {showPhotoMenu === item.id && (
                            <div className="absolute bottom-full left-0 mb-1 bg-white rounded-xl shadow-xl border border-gray-100 p-1 z-50 min-w-[160px]">
                              <label className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium cursor-pointer hover:bg-gray-50 rounded-lg"
                                style={{ color: "#006494" }}>
                                📸 Снимай
                                <input type="file" accept="image/*" capture="environment" className="hidden"
                                  onChange={(e) => handleFileInput(item.id, e)} />
                              </label>
                              <label className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium cursor-pointer hover:bg-gray-50 rounded-lg"
                                style={{ color: "#006494" }}>
                                🖼️ От галерия
                                <input type="file" accept="image/*" className="hidden"
                                  onChange={(e) => handleFileInput(item.id, e)} />
                              </label>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 p-4 border-t flex-shrink-0" style={{ borderColor: "#e4e9f0", background: "#fff", paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
          <div className="flex-1 text-xs font-semibold" style={{ color: "#247ba0" }}>
            📍 {gps ? "GPS ✓" : "GPS ✗"} · 📷 {Object.values(photos).flat().length} снимки
          </div>
          <button
            onClick={() => onComplete({ items, gps })}
            disabled={pct < 50 && !gps}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-40"
            style={{ background: pct >= 100 ? "linear-gradient(140deg, #16a34a, #15803d)" : "linear-gradient(140deg, #1b98e0, #006494)" }}>
            {pct >= 100 ? "✅ Завърши обход" : `Завърши (${pct}%)`}
          </button>
        </div>
      </div>

      {/* Photo viewer */}
      {viewerPhoto && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center" onClick={() => setViewerPhoto(null)}>
          <img src={viewerPhoto} alt="preview" className="max-w-full max-h-full object-contain" />
          <button className="absolute top-4 right-4 text-white text-2xl" onClick={() => setViewerPhoto(null)}>✕</button>
        </div>
      )}
    </>
  );
}
