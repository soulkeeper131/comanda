"use client";

import { useState } from "react";

type Props = {
  propertyName?: string;
  propertyAddr?: string;
  propertyId?: string;
  jobId?: string;
  jobItemId?: string;
  onClose: () => void;
  onSave: (data: {
    type: string;
    title: string;
    body: string;
    propertyId?: string;
    jobId?: string;
    jobItemId?: string;
  }) => void;
};

const PROBLEM_TYPES = ["Теч", "Мухъл/влага", "Повреда", "Липса", "Друго"];

export default function FindingsSheet({
  propertyName,
  propertyAddr,
  propertyId,
  jobId,
  jobItemId,
  onClose,
  onSave,
}: Props) {
  const [type, setType] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [viewerPhoto, setViewerPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const canSave = type && title.trim();

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && photos.length < 3) {
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (res.ok) {
          const json = await res.json();
          setPhotos((prev) => [...prev, json.url]);
        }
      } catch {
        // silently ignore upload errors
      }
      setUploading(false);
    }
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    await onSave({ type, title, body, propertyId, jobId, jobItemId });
    setSaving(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.3)" }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl flex flex-col"
        style={{
          background: "#fff",
          maxHeight: "90dvh",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.12)",
        }}
      >
        {/* Grip */}
        <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: "#d8dee6" }}
          />
        </div>

        {/* Header */}
        <div
          className="flex items-start gap-3 px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: "#e4e9f0" }}
        >
          <div className="flex-1 min-w-0">
            <h3
              className="text-lg font-bold"
              style={{ color: "#006494" }}
            >
              ⚠️ Докладвай проблем
            </h3>
            {(propertyName || propertyAddr) && (
              <p
                className="text-xs mt-0.5 truncate"
                style={{ color: "#247ba0" }}
              >
                {propertyName}
                {propertyAddr && ` · ${propertyAddr.split(",")[0]}`}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "#f1f5f9", color: "#64748b", fontSize: 15 }}
          >
            ✕
          </button>
        </div>

        {/* Body - scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Type select */}
          <label
            className="block text-xs font-bold uppercase tracking-wide mb-2"
            style={{ color: "#64748b" }}
          >
            Тип проблем
          </label>
          <div className="flex flex-wrap gap-2 mb-4">
            {PROBLEM_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className="px-3 min-h-[44px] py-2.5 rounded-xl text-sm font-semibold border transition"
                style={{
                  borderColor: type === t ? "#1b98e0" : "#e4e9f0",
                  background: type === t ? "#eff6ff" : "#fff",
                  color: type === t ? "#1b98e0" : "#64748b",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Title */}
          <label
            className="block text-xs font-bold uppercase tracking-wide mb-1"
            style={{ color: "#64748b" }}
          >
            Заглавие
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Напр. Теч под мивката"
            className="w-full px-4 py-3 rounded-xl border text-base mb-4"
            style={{
              borderColor: "#e4e9f0",
              fontSize: 16,
              color: "#006494",
              outline: "none",
            }}
          />

          {/* Description */}
          <label
            className="block text-xs font-bold uppercase tracking-wide mb-1"
            style={{ color: "#64748b" }}
          >
            Описание
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Опиши какво си видял..."
            rows={4}
            className="w-full px-4 py-3 rounded-xl border text-base resize-none mb-4"
            style={{
              borderColor: "#e4e9f0",
              fontSize: 16,
              color: "#006494",
              outline: "none",
            }}
          />

          {/* Photos */}
          <label
            className="block text-xs font-bold uppercase tracking-wide mb-2"
            style={{ color: "#64748b" }}
          >
            Снимки ({photos.length}/3)
          </label>

          {photos.length > 0 && (
            <div className="flex gap-2 mb-3 flex-wrap">
              {photos.map((url, idx) => (
                <div key={idx} className="relative">
                  <img
                    src={url}
                    alt={`Снимка ${idx + 1}`}
                    className="w-20 h-20 rounded-xl object-cover border cursor-pointer"
                    style={{ borderColor: "#e4e9f0" }}
                    onClick={() => setViewerPhoto(url)}
                  />
                  <button
                    onClick={() => removePhoto(idx)}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs"
                    style={{ background: "#dc2626" }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {photos.length < 3 && (
            <label
              className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border ${uploading ? "" : "cursor-pointer"}`}
              style={{
                borderColor: "#c9ddf0",
                color: "#1b98e0",
                background: "#eff6ff",
              }}
            >
              {uploading ? (
                "⏳ Качване..."
              ) : (
                <>
                  📷 Добави снимка
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileInput}
                    disabled={uploading}
                  />
                </>
              )}
            </label>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-3 p-4 border-t flex-shrink-0"
          style={{ borderColor: "#e4e9f0", background: "#fff", paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={onClose}
            className="px-4 min-h-[44px] py-3 rounded-xl text-sm font-semibold border"
            style={{ borderColor: "#e4e9f0", color: "#64748b" }}
          >
            Отказ
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="flex-1 px-5 min-h-[44px] py-3 rounded-xl text-sm font-semibold text-white transition disabled:opacity-40"
            style={{
              background:
                "linear-gradient(140deg, #1b98e0, #006494)",
            }}
          >
            {saving ? "Изпращане..." : "⚠️ Докладвай"}
          </button>
        </div>
      </div>

      {/* Photo viewer */}
      {viewerPhoto && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center"
          onClick={() => setViewerPhoto(null)}
        >
          <img
            src={viewerPhoto}
            alt="preview"
            className="max-w-full max-h-full object-contain"
          />
          <button
            className="absolute top-4 right-4 text-white text-2xl"
            onClick={() => setViewerPhoto(null)}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
