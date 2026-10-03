"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

type Props = {
  title: string;
  subtitle?: string | null;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * Панел на цял екран над чеклиста (който сам е на цял екран, z-50) — затова
 * не ползваме Sheet, чийто фон е z-40 и би останал под чеклиста.
 */
export default function FullScreenPanel({ title, subtitle, onClose, children, footer }: Props) {
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="flex flex-shrink-0 items-start gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brand-bg text-muted"
          aria-label="Затвори"
        >
          <Icon name="x" size={22} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
      {footer && (
        <div
          className="flex-shrink-0 space-y-2 border-t border-line px-4 py-3"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
