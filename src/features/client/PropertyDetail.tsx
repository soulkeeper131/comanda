"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import PlanSelector from "@/components/PlanSelector";
import { formatWhen, formatMoney } from "./format";
import { photoUrl } from "./types";
import type {
  ClientJob,
  ClientOffer,
  ClientPlan,
  ServiceTemplate,
  OverrideRecord,
  JobDetail,
} from "./types";

type Props = {
  propertyId: string;
  propertyName: string;
  /** Когато клиентът има няколко имота — бутон "назад към списъка". */
  onBack?: () => void;
};

/**
 * Екранът на един имот. Отговаря на три въпроса, в този ред:
 *   1. Какво предстои?
 *   2. Какво е свършено (с доказателство)?
 *   3. Какво чака мен (оферти)?
 * Плюс: ако няма абонамент — какво предлагаме и как да се заяви.
 */
export default function PropertyDetail({ propertyId, propertyName, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [upcomingJob, setUpcomingJob] = useState<ClientJob | null>(null);
  const [lastCompletedJob, setLastCompletedJob] = useState<JobDetail | null>(null);
  const [checkinOverride, setCheckinOverride] = useState<OverrideRecord | null>(null);
  const [itemOverridesByItemId, setItemOverridesByItemId] = useState<Record<string, OverrideRecord>>({});
  const [offers, setOffers] = useState<ClientOffer[]>([]);
  const [plans, setPlans] = useState<ClientPlan[]>([]);
  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  const [showPlanSelector, setShowPlanSelector] = useState(false);
  const [decidingOfferId, setDecidingOfferId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [jobsRes, offersRes, plansRes, templatesRes] = await Promise.all([
        fetch("/api/jobs").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/offers").then((r) => (r.ok ? r.json() : [])),
        fetch(`/api/properties/${propertyId}/plans`).then((r) => (r.ok ? r.json() : [])),
        fetch("/api/templates").then((r) => (r.ok ? r.json() : [])),
      ]);

      const allJobs: ClientJob[] = (jobsRes || []).filter((j: ClientJob) => j.property_id === propertyId);

      const upcoming = allJobs
        .filter((j) => j.status === "planned" || j.status === "in_progress")
        .sort((a, b) => new Date(a.planned_at).getTime() - new Date(b.planned_at).getTime())[0];
      setUpcomingJob(upcoming || null);

      const completed = allJobs
        .filter((j) => j.status === "completed")
        .sort(
          (a, b) =>
            new Date(b.completed_at || b.planned_at).getTime() -
            new Date(a.completed_at || a.planned_at).getTime(),
        )[0];

      if (completed) {
        const detail: JobDetail | null = await fetch(`/api/jobs/${completed.id}`).then((r) =>
          r.ok ? r.json() : null,
        );
        setLastCompletedJob(detail);

        if (detail) {
          // Проверка на прескачания: check-in геофенсинг + всяка стъпка без снимка.
          const checkinRes = await fetch(`/api/overrides?entity_type=job_checkin&entity_id=${detail.id}`).then(
            (r) => (r.ok ? r.json() : []),
          );
          setCheckinOverride((checkinRes as OverrideRecord[])[0] || null);

          const itemIds = (detail.items || []).map((i) => i.id);
          if (itemIds.length > 0) {
            const itemOverridesRes = await fetch(
              `/api/overrides?entity_type=job_item&entity_id=${itemIds.join(",")}`,
            ).then((r) => (r.ok ? r.json() : []));
            const byItem: Record<string, OverrideRecord> = {};
            for (const o of itemOverridesRes as OverrideRecord[]) byItem[o.entity_id] = o;
            setItemOverridesByItemId(byItem);
          } else {
            setItemOverridesByItemId({});
          }
        }
      } else {
        setLastCompletedJob(null);
        setCheckinOverride(null);
        setItemOverridesByItemId({});
      }

      const propOffers: ClientOffer[] = (offersRes || []).filter(
        (o: ClientOffer) => o.finding?.property_id === propertyId,
      );
      setOffers(propOffers);

      setPlans(plansRes || []);
      setTemplates((templatesRes || []).filter((t: ServiceTemplate) => !t.archived && t.bookable));
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    load();
  }, [load]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const decideOffer = async (offerId: string, decision: "accepted" | "declined") => {
    setDecidingOfferId(offerId);
    try {
      const res = await fetch(`/api/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (res.ok) {
        showToast(decision === "accepted" ? "Офертата е приета." : "Офертата е отказана.");
        setOffers((prev) => prev.map((o) => (o.id === offerId ? { ...o, decision } : o)));
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || "Грешка при запис на решението.");
      }
    } catch {
      showToast("Грешка при връзката. Опитайте отново.");
    } finally {
      setDecidingOfferId(null);
    }
  };

  const pendingOffers = offers.filter((o) => o.decision === "pending");
  const activePlans = plans.filter((p) => p.active);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-muted">Зареждане на имота…</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
      {onBack && (
        <button onClick={onBack} className="text-sm font-semibold text-brand-primary">
          ← Всички имоти
        </button>
      )}

      <h1 className="text-xl font-bold text-ink">{propertyName}</h1>

      {toast && (
        <div className="rounded-lg bg-brand-dark px-3 py-2 text-sm text-white">{toast}</div>
      )}

      {/* 1. Какво предстои */}
      <Card padding="md" shadow="sm">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Предстои</h2>
        {upcomingJob ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-ink">{upcomingJob.title || "Обход"}</div>
              <div className="text-sm text-muted">
                {upcomingJob.status === "in_progress"
                  ? "Обходът тече в момента"
                  : `Планиран за ${formatWhen(upcomingJob.planned_at)}`}
              </div>
            </div>
            {upcomingJob.status === "in_progress" && <Badge tone="info">В момента</Badge>}
          </div>
        ) : (
          <p className="text-sm text-muted">
            Няма планиран обход в момента. Ще видите тук датата, щом бъде насрочен.
          </p>
        )}
      </Card>

      {/* 2. Какво е свършено */}
      <Card padding="md" shadow="sm">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Последно свършено</h2>
        {lastCompletedJob ? (
          <div className="space-y-3">
            <div>
              <div className="font-semibold text-ink">{lastCompletedJob.title || "Обход"}</div>
              <div className="text-sm text-muted">
                Завършен {formatWhen(lastCompletedJob.completed_at || lastCompletedJob.planned_at)}
              </div>
            </div>

            {checkinOverride && (
              <p className="rounded-lg bg-state-warning/10 px-3 py-2 text-sm text-state-warning">
                Проверката при пристигане е прескочена от админ — причина: {checkinOverride.reason}
              </p>
            )}

            {/* Снимките са доказателството — водещ елемент, не бележка. */}
            <CompletedJobPhotos job={lastCompletedJob} itemOverrides={itemOverridesByItemId} />
          </div>
        ) : (
          <p className="text-sm text-muted">
            Още няма завършени обходи. Първият ще се появи тук със снимките.
          </p>
        )}
      </Card>

      {/* 3. Какво чака мен */}
      {pendingOffers.length > 0 && (
        <Card padding="md" shadow="sm">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Чака решение</h2>
          <div className="space-y-3">
            {pendingOffers.map((offer) => (
              <div key={offer.id} className="rounded-lg border border-line p-3">
                <div className="font-semibold text-ink">{offer.finding?.title || "Констатация"}</div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  <span>Цена: {formatMoney(offer.price)}</span>
                  <span>Срок: {offer.days ?? "—"} дни</span>
                </div>
                {offer.scope && <p className="mt-1 text-sm text-ink">{offer.scope}</p>}
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => decideOffer(offer.id, "accepted")}
                    disabled={decidingOfferId === offer.id}
                  >
                    Приемам офертата
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => decideOffer(offer.id, "declined")}
                    disabled={decidingOfferId === offer.id}
                  >
                    Отказвам
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Абонамент / каталог */}
      {activePlans.length === 0 && (
        <Card padding="md" shadow="sm">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted">Абонамент</h2>
          <p className="mb-3 text-sm text-muted">
            Този имот все още няма редовно обслужване. Ето какво предлагаме:
          </p>
          {templates.length > 0 ? (
            <ul className="mb-3 space-y-1.5">
              {templates.map((t) => (
                <li key={t.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink">{t.name}</span>
                  <span className="text-muted">{formatMoney(t.price)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-sm text-muted">В момента няма активни пакети в каталога.</p>
          )}
          <Button size="sm" onClick={() => setShowPlanSelector(true)}>
            Заявете пакет
          </Button>
        </Card>
      )}

      {showPlanSelector && (
        <PlanSelector
          propertyId={propertyId}
          onDone={() => {
            setShowPlanSelector(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function CompletedJobPhotos({
  job,
  itemOverrides,
}: {
  job: JobDetail;
  itemOverrides: Record<string, OverrideRecord>;
}) {
  const allPhotos = [
    ...job.photos.map((p) => ({ ...p, itemId: null as string | null, itemLabel: null as string | null })),
    ...job.items.flatMap((item) =>
      item.photos.map((p) => ({ ...p, itemId: item.id, itemLabel: item.label })),
    ),
  ];

  const skippedItems = job.items.filter((i) => i.photos.length === 0 && itemOverrides[i.id]);

  if (allPhotos.length === 0 && skippedItems.length === 0) {
    return <p className="text-sm text-muted">Няма прикачени снимки за този обход.</p>;
  }

  return (
    <div className="space-y-2">
      {allPhotos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {allPhotos.map((p) => (
            <a
              key={p.id}
              href={photoUrl(p.storage_path)}
              target="_blank"
              rel="noreferrer"
              className="block aspect-square overflow-hidden rounded-lg border border-line bg-brand-bg"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl(p.storage_path)}
                alt={p.itemLabel || "Снимка от обход"}
                className="h-full w-full object-cover"
              />
            </a>
          ))}
        </div>
      )}
      {skippedItems.map((item) => (
        <p key={item.id} className="rounded-lg bg-state-warning/10 px-3 py-2 text-sm text-state-warning">
          „{item.label}&rdquo; — проверката е прескочена от админ — причина: {itemOverrides[item.id].reason}
        </p>
      ))}
    </div>
  );
}
