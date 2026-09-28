"use client";

import { Icon } from "@/components/ui/Icon";

export default function PhotoViewer({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90" onClick={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Преглед" className="max-h-full max-w-full object-contain" />
      <button
        type="button"
        className="absolute right-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white"
        style={{ top: "max(16px, env(safe-area-inset-top))" }}
        onClick={onClose}
        aria-label="Затвори преглед"
      >
        <Icon name="x" size={26} />
      </button>
    </div>
  );
}
