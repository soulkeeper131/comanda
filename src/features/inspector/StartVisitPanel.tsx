"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import AccessInfo from "./AccessInfo";
import type { GeoState } from "./hooks";
import type { JobDetail } from "./types";

type Props = {
  detail: JobDetail;
  geo: GeoState & { retry: () => void };
  online: boolean;
  /** Стартът е в опашката — чака връзка. */
  pendingStart: boolean;
  starting: boolean;
  startError: string | null;
  outOfRange: boolean;
  onStart: () => void;
  onCancel: () => void;
};

/**
 * Стартов екран: как се влиза в имота + GPS проверка + "Старт". Стъпките на
 * обхода се създават от сървъра при старта (копие от шаблона), затова без
 * връзка обходът не може да започне веднага — стартът се записва с
 * координатите и часа от този момент и се изпраща при връзка.
 */
export default function StartVisitPanel({
  detail,
  geo,
  online,
  pendingStart,
  starting,
  startError,
  outOfRange,
  onStart,
  onCancel,
}: Props) {
  const unassigned = !detail.assignee_id;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="mx-auto max-w-md space-y-5">
        <AccessInfo detail={detail} />

        {unassigned && (
          <p className="rounded-card bg-brand-accent/10 px-3 py-2 text-sm font-semibold text-brand-accent">
            Невъзложен обход — като го стартирате, той става ваш.
          </p>
        )}

        {pendingStart ? (
          <div className="space-y-2 rounded-card border border-state-warning/40 bg-state-warning/10 px-4 py-4 text-center">
            <Icon name="clock" size={28} className="mx-auto text-state-warning" />
            <p className="text-lg font-bold text-ink">Обходът ще започне при връзка</p>
            <p className="text-sm text-ink">
              Стартът е записан с вашата локация и час. Стъпките ще се появят, щом сървърът потвърди старта —
              тогава може да снимате и отмятате.
            </p>
          </div>
        ) : (
          <div className="space-y-3 text-center">
            <p className="text-base text-ink">За да започнете обхода, трябва да сте на адреса на имота.</p>

            {geo.locating && <p className="text-sm text-muted">Търсене на локация…</p>}
            {geo.error && (
              <div className="space-y-2">
                <p className="text-sm text-state-danger">{geo.error}</p>
                <Button size="md" variant="secondary" onClick={geo.retry}>
                  Опитайте отново
                </Button>
              </div>
            )}
            {geo.fix && (
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-state-ok">
                <Icon name="check" size={18} />
                Локацията е намерена
              </p>
            )}

            {startError && (
              <div className="space-y-1 rounded-card bg-state-danger/10 px-3 py-2 text-left text-sm text-state-danger">
                <p>{startError}</p>
                {outOfRange && (
                  <p className="text-xs">
                    Ако адресът е верен, свържете се с админ — само той може да стартира обход извън обхвата.
                  </p>
                )}
              </div>
            )}

            {!online && (
              <p className="flex items-start gap-2 rounded-card bg-ink/5 px-3 py-2 text-left text-sm text-ink">
                <Icon name="wifi-off" size={18} className="mt-0.5" />
                Няма връзка. Стартът ще се запише сега и ще се изпрати при връзка — стъпките се появяват след това.
              </p>
            )}

            <Button size="lg" fullWidth disabled={starting || geo.locating} onClick={onStart}>
              <Icon name="play" size={20} />
              {starting ? "Стартиране…" : "Старт на обхода"}
            </Button>
          </div>
        )}

        {!unassigned && (
          <div className="pt-2 text-center">
            <button type="button" onClick={onCancel} className="min-h-touch px-4 text-sm font-semibold text-state-danger">
              Откажи обхода
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
