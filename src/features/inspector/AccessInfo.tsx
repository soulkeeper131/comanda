"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { JobDetail } from "./types";

type Props = {
  detail: Pick<JobDetail, "property_address" | "property_lat" | "property_lng" | "access_notes" | "contact_name" | "contact_phone">;
  /** По време на обхода — сгъната лента под заглавието. */
  collapsible?: boolean;
};

function hasInfo(d: Props["detail"]) {
  return Boolean(d.property_address || d.access_notes || d.contact_phone);
}

/**
 * Как да влезе в имота: адрес (с карта), кого да търси и бележки за достъпа.
 * На стартовия екран е разгъната, по време на обхода — сгъната.
 */
export default function AccessInfo({ detail, collapsible = false }: Props) {
  const [open, setOpen] = useState(!collapsible);
  if (!hasInfo(detail)) return null;

  const mapsHref =
    detail.property_lat != null && detail.property_lng != null
      ? `https://maps.google.com/?q=${detail.property_lat},${detail.property_lng}`
      : detail.property_address
        ? `https://maps.google.com/?q=${encodeURIComponent(detail.property_address)}`
        : null;

  const body = (
    <div className="space-y-3">
      {detail.property_address && (
        <div className="flex items-start gap-3">
          <Icon name="pin" size={22} className="mt-0.5 text-brand-secondary" />
          <div className="min-w-0 flex-1">
            <p className="text-base text-ink">{detail.property_address}</p>
            {mapsHref && (
              <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex min-h-touch items-center gap-1.5 text-sm font-semibold text-brand-primary"
              >
                <Icon name="map" size={18} />
                Отвори в карта
              </a>
            )}
          </div>
        </div>
      )}

      {detail.contact_phone && (
        <a
          href={`tel:${detail.contact_phone.replace(/\s+/g, "")}`}
          className="flex min-h-[52px] items-center gap-3 rounded-card border border-brand-primary/30 bg-brand-bg px-4 text-brand-secondary"
        >
          <Icon name="phone" size={22} />
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold">Обади се</span>
            <span className="block truncate text-sm">
              {detail.contact_name ? `${detail.contact_name} · ` : ""}
              {detail.contact_phone}
            </span>
          </span>
        </a>
      )}

      {detail.access_notes && (
        <div className="flex items-start gap-3 rounded-card bg-state-warning/10 px-3 py-2.5">
          <Icon name="shield" size={20} className="mt-0.5 text-state-warning" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-state-warning">Достъп</p>
            <p className="whitespace-pre-line text-base text-ink">{detail.access_notes}</p>
          </div>
        </div>
      )}
    </div>
  );

  if (!collapsible) return body;

  return (
    <div className="border-b border-line bg-brand-bg/40 px-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-touch w-full items-center gap-2 text-left text-sm font-semibold text-brand-secondary"
        aria-expanded={open}
      >
        <Icon name="pin" size={18} />
        <span className="flex-1">Адрес и достъп</span>
        <Icon name="chevron-down" size={20} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="pb-3">{body}</div>}
    </div>
  );
}
