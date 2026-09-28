"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";

/** Кратко съобщение долу на екрана. */
export function useToast() {
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    if (timer.current) clearTimeout(timer.current);
    setMessage({ text, tone });
    timer.current = setTimeout(() => setMessage(null), 3200);
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const node = message ? (
    <div
      role="status"
      className={`fixed inset-x-4 bottom-24 z-[70] md:bottom-6 mx-auto max-w-md rounded-card px-4 py-3 text-sm font-semibold text-white shadow-card-3 ${
        message.tone === "error" ? "bg-state-danger" : "bg-brand-dark"
      }`}
    >
      {message.text}
    </div>
  ) : null;
  return { show, node };
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, text }: { icon: IconName; title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-line bg-white/60 px-6 py-8 text-center">
      <Icon name={icon} size={28} className="text-muted" />
      <p className="font-semibold text-ink">{title}</p>
      {text && <p className="text-sm text-muted">{text}</p>}
    </div>
  );
}

export function Loading({ text = "Зареждане…" }: { text?: string }) {
  return <div className="py-10 text-center text-sm text-muted">{text}</div>;
}

export function Chips<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-[36px] whitespace-nowrap rounded-full px-3 text-sm font-semibold transition ${
            value === o.value ? "bg-brand-primary text-white" : "bg-white text-brand-secondary border border-line"
          }`}
        >
          {o.label}
          {o.count !== undefined && o.count > 0 && (
            <span className={`ml-1.5 rounded-full px-1.5 text-xs ${value === o.value ? "bg-white/25" : "bg-brand-bg"}`}>
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * Потвърждение с причина — за действия, които трябва да оставят следа
 * (отказ на имот, отказ на обход). Минимум 5 знака, както навсякъде.
 */
export function ReasonSheet({
  open,
  title,
  description,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: (reason: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setReason("");
  }, [open]);
  const valid = reason.trim().length >= 5;
  return (
    <Sheet open={open} onClose={onClose}>
      <h3 className="mb-1 text-lg font-bold text-ink">{title}</h3>
      {description && <p className="mb-3 text-sm text-muted">{description}</p>}
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="Причина (поне 5 знака)"
        className="w-full rounded-card border border-line px-3 py-2 text-field text-ink focus:border-brand-primary focus:outline-none"
      />
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" fullWidth onClick={onClose}>
          Назад
        </Button>
        <Button
          variant={danger ? "danger" : "primary"}
          fullWidth
          disabled={!valid || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm(reason.trim());
            } finally {
              setBusy(false);
            }
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-ink-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full min-h-touch rounded-card border border-line bg-white px-3 text-field text-ink focus:border-brand-primary focus:outline-none";

export function PhotoStrip({ urls, onOpen }: { urls: string[]; onOpen?: (url: string) => void }) {
  if (urls.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {urls.map((u) => (
        <button key={u} onClick={() => onOpen?.(u)} className="h-16 w-16 overflow-hidden rounded-lg border border-line bg-brand-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={u} alt="Снимка" className="h-full w-full object-cover" loading="lazy" />
        </button>
      ))}
    </div>
  );
}

export function PhotoViewer({ url, onClose }: { url: string | null; onClose: () => void }) {
  if (!url) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90" onClick={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Снимка" className="max-h-full max-w-full object-contain" />
      <button
        className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white"
        onClick={onClose}
        aria-label="Затвори"
      >
        <Icon name="x" size={24} />
      </button>
    </div>
  );
}
