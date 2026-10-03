"use client";

import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { formatWhen } from "@/lib/format";
import { api } from "./api";
import { EmptyState, inputClass } from "./ui";
import type { Inquiry } from "./types";

const LABEL: Record<Inquiry["status"], string> = {
  new: "Ново",
  contacted: "Свързах се",
  converted: "Стана клиент",
  closed: "Затворено",
};

/** Запитванията от публичната страница — кой се е интересувал и докъде сме. */
export default function InquiriesList({
  inquiries,
  onChanged,
}: {
  inquiries: Inquiry[];
  onChanged: (message: string, tone?: "ok" | "error") => void;
}) {
  if (inquiries.length === 0) return <EmptyState icon="mail" title="Няма запитвания" text="Формата е на началната страница." />;
  return (
    <div className="space-y-2">
      {inquiries.map((i) => (
        <Card key={i.id} padding="sm">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-ink">
                {i.full_name}
                {i.city ? ` · ${i.city}` : ""}
              </div>
              <div className="text-sm text-muted">{[i.service, i.property_kind].filter(Boolean).join(" · ")}</div>
              {i.message && <p className="mt-1 text-sm text-ink-2">{i.message}</p>}
              <div className="mt-1 flex flex-wrap gap-3 text-sm">
                {i.phone && (
                  <a href={`tel:${i.phone}`} className="inline-flex items-center gap-1 font-semibold text-brand-primary">
                    <Icon name="phone" size={14} /> {i.phone}
                  </a>
                )}
                {i.email && (
                  <a href={`mailto:${i.email}`} className="inline-flex items-center gap-1 font-semibold text-brand-primary">
                    <Icon name="mail" size={14} /> {i.email}
                  </a>
                )}
              </div>
              <div className="text-xs text-muted">{formatWhen(i.created_at)}</div>
            </div>
            <select
              className={`${inputClass} w-auto min-w-[140px]`}
              aria-label="Статус"
              value={i.status}
              onChange={async (e) => {
                const res = await api(`/api/inquiries/${i.id}`, { method: "PATCH", body: { status: e.target.value } });
                onChanged(res.ok ? "Запазено" : res.error, res.ok ? "ok" : "error");
              }}
            >
              {Object.entries(LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </Card>
      ))}
    </div>
  );
}
