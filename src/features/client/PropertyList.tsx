"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { ClientProperty } from "./types";

const STATUS_LABEL: Record<ClientProperty["status"], { text: string; tone: "ok" | "warning" | "danger" | "info" }> = {
  ok: { text: "Всичко е наред", tone: "ok" },
  in_progress: { text: "Обход в момента", tone: "info" },
  warning: { text: "Има отворена констатация", tone: "warning" },
  overdue: { text: "Обход закъснява", tone: "danger" },
};

/**
 * Компактен списък, когато клиентът има повече от един имот. Име, адрес,
 * състояние с една дума — не таблица с колони. Клик отваря екрана на имота
 * (същия екран, който самостоятелен собственик вижда директно).
 */
export default function PropertyList({
  properties,
  onSelect,
}: {
  properties: ClientProperty[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <h2 className="mb-3 text-lg font-bold text-ink">Вашите имоти</h2>
      <div className="space-y-2.5">
        {properties.map((p) => {
          const status = STATUS_LABEL[p.status] ?? STATUS_LABEL.ok;
          return (
            <button key={p.id} onClick={() => onSelect(p.id)} className="block w-full text-left">
              <Card padding="md" shadow="sm" className="flex items-center justify-between gap-3 transition hover:shadow-card-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-ink">{p.name}</div>
                  <div className="truncate text-sm text-muted">
                    {[p.city, p.address].filter(Boolean).join(", ") || "Няма въведен адрес"}
                  </div>
                </div>
                <Badge tone={status.tone} className="shrink-0">
                  {status.text}
                </Badge>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}
