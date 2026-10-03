"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { QueuedAction, RejectedAction } from "@/lib/offline-sync";

type Props = {
  online: boolean;
  pending: QueuedAction[];
  rejected: RejectedAction[];
  syncing: boolean;
  onSync: () => void;
  onDismiss: (actionId: string) => void;
  /** Бележка при показване от кеша ("Запазено на …"). */
  cacheNote?: string | null;
};

function actionsWord(n: number) {
  return n === 1 ? "действие чака" : "действия чакат";
}

/**
 * Офлайн лента: без връзка / чакащи действия / отхвърлени при синхронизация.
 * Отхвърленото стои тук с причината от сървъра, докато инспекторът не
 * натисне "Разбрах" — никога не изчезва тихо.
 */
export default function OfflineBar({ online, pending, rejected, syncing, onSync, onDismiss, cacheNote }: Props) {
  if (online && pending.length === 0 && rejected.length === 0 && !cacheNote) return null;

  return (
    <div className="space-y-2" role="status" aria-live="polite">
      {!online && (
        <div className="flex items-start gap-3 rounded-card bg-ink px-3 py-2.5 text-white">
          <Icon name="wifi-off" size={22} className="mt-0.5" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="text-base font-semibold">Няма връзка</p>
            <p className="text-white/80">
              Снимките и отметките се пазят на телефона и се изпращат при връзка. Сървърът ги проверява тогава.
            </p>
          </div>
        </div>
      )}

      {cacheNote && <p className="px-1 text-sm text-muted">{cacheNote}</p>}

      {pending.length > 0 && (
        <div className="flex items-center gap-3 rounded-card border border-state-warning/40 bg-state-warning/10 px-3 py-2">
          <Icon name="upload" size={20} className="text-state-warning" />
          <p className="min-w-0 flex-1 text-sm font-semibold text-ink">
            {pending.length} {actionsWord(pending.length)} синхронизация
          </p>
          <Button size="sm" variant="secondary" disabled={syncing} onClick={onSync} className="min-h-touch">
            <Icon name="refresh" size={18} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Изпращане…" : "Синхронизирай"}
          </Button>
        </div>
      )}

      {rejected.map((r) => (
        <div key={r.action.id} className="rounded-card border border-state-danger/40 bg-state-danger/10 px-3 py-2.5">
          <div className="flex items-start gap-3">
            <Icon name="alert" size={20} className="mt-0.5 text-state-danger" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-state-danger">Отхвърлено: {r.action.label}</p>
              <p className="text-sm text-ink">{r.reason}</p>
              {r.details.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-sm text-ink">
                  {r.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="mt-2 flex justify-end">
            <Button size="sm" variant="secondary" className="min-h-touch" onClick={() => onDismiss(r.action.id)}>
              <Icon name="check" size={18} />
              Разбрах
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
