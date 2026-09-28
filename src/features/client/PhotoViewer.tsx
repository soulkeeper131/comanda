"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";

export type ViewerPhoto = { id: string; src: string; caption?: string | null };

/** Снимка на цял екран — с листане напред/назад и затваряне с Esc. */
export function PhotoViewer({
  photos,
  index,
  onClose,
}: {
  photos: ViewerPhoto[];
  index: number;
  onClose: () => void;
}) {
  const [i, setI] = useState(index);
  const photo = photos[i];
  const prev = () => setI((x) => (x - 1 + photos.length) % photos.length);
  const next = () => setI((x) => (x + 1) % photos.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setI((x) => (x - 1 + photos.length) % photos.length);
      if (e.key === "ArrowRight") setI((x) => (x + 1) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, photos.length]);

  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/95 safe-bottom"
      role="dialog"
      aria-modal="true"
      aria-label="Снимка"
    >
      <div className="flex items-center justify-between px-2 pt-2 text-white">
        <span className="px-2 text-sm text-white/70">
          {i + 1} / {photos.length}
        </span>
        <button
          onClick={onClose}
          className="flex h-touch w-touch items-center justify-center rounded-full hover:bg-white/10"
          aria-label="Затвори"
        >
          <Icon name="x" size={24} />
        </button>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden" onClick={onClose}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.src}
          alt={photo.caption || "Снимка"}
          className="max-h-full max-w-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
        {photos.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              className="absolute left-2 flex h-touch w-touch items-center justify-center rounded-full bg-black/40 text-white"
              aria-label="Предишна снимка"
            >
              <Icon name="chevron-left" size={24} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="absolute right-2 flex h-touch w-touch items-center justify-center rounded-full bg-black/40 text-white"
              aria-label="Следваща снимка"
            >
              <Icon name="chevron-right" size={24} />
            </button>
          </>
        )}
      </div>
      {photo.caption && <p className="px-4 py-3 text-center text-sm text-white/90">{photo.caption}</p>}
    </div>
  );
}

/** Решетка от снимки; докосване отваря снимката на цял екран. */
export function PhotoGrid({
  photos,
  columns = 3,
}: {
  photos: ViewerPhoto[];
  columns?: 2 | 3;
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (photos.length === 0) return null;
  return (
    <>
      <div className={`grid gap-2 ${columns === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {photos.map((p, idx) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpen(idx)}
            className="block aspect-square overflow-hidden rounded-card border border-line bg-brand-bg"
            aria-label={p.caption ? `Снимка: ${p.caption}` : "Отвори снимката"}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.src} alt={p.caption || "Снимка"} loading="lazy" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      {open !== null && <PhotoViewer photos={photos} index={open} onClose={() => setOpen(null)} />}
    </>
  );
}
