"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { APPROVAL } from "./PropertyHeader";
import type { ClientProperty } from "./types";

type Tone = "ok" | "warning" | "danger" | "info";

const STATUS_LABEL: Record<"ok" | "warning" | "overdue" | "in_progress", { text: string; tone: Tone }> = {
  ok: { text: "Всичко е наред", tone: "ok" },
  in_progress: { text: "Обход в момента", tone: "info" },
  warning: { text: "Има открит проблем", tone: "warning" },
  overdue: { text: "Обход закъснява", tone: "danger" },
};

function statusOf(p: ClientProperty): { text: string; tone: Tone } {
  if (p.approval_status !== "active") return APPROVAL[p.approval_status] ?? APPROVAL.pending;
  const key = p.status as keyof typeof STATUS_LABEL;
  return STATUS_LABEL[key] ?? STATUS_LABEL.ok;
}

/**
 * Компактен списък, когато клиентът има повече от един имот. Име, адрес,
 * състояние с една дума (или че чака одобрение). Клик отваря екрана на имота.
 */
export default function PropertyList({
  properties,
  onSelect,
}: {
  properties: ClientProperty[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 py-4">
      <h2 className="mb-3 text-lg font-bold text-ink">Вашите имоти</h2>
      <div className="space-y-2.5">
        {properties.map((p) => {
          const status = statusOf(p);
          return (
            <button key={p.id} onClick={() => onSelect(p.id)} className="block w-full text-left">
              <Card padding="md" shadow="sm" className="flex min-h-touch items-center gap-3 transition hover:shadow-card-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-bg text-brand-primary">
                  <Icon name="home" size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-ink">{p.name}</div>
                  <div className="truncate text-sm text-muted">
                    {[p.city, p.address].filter(Boolean).join(", ") || "Няма въведен адрес"}
                  </div>
                </div>
                <Badge tone={status.tone} className="shrink-0">
                  {status.text}
                </Badge>
                <Icon name="chevron-right" size={18} className="text-muted" />
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}
