"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PlanSelector from "@/components/PlanSelector";
import { isLivePlan } from "@/lib/domain/plans";
import PropertyHeader from "./PropertyHeader";
import LastVisitSection from "./LastVisitSection";
import UpcomingSection from "./UpcomingSection";
import FindingsSection from "./FindingsSection";
import SubscriptionSection from "./SubscriptionSection";
import HistorySection from "./HistorySection";
import { getOr } from "./api";
import { parseDate, todayKey } from "./format";
import type { ClientFinding, ClientJob, ClientOffer, ClientPayment, ClientPlan, ClientProperty } from "./types";

type Props = {
  property: ClientProperty;
  /** Когато клиентът има няколко имота — бутон "назад към списъка". */
  onBack?: () => void;
  /** Презарежда имота (след промяна на данните за достъп). */
  onPropertyChanged: () => void;
};

const time = (v: string | null | undefined) => parseDate(v)?.getTime() ?? 0;

/**
 * Екранът на един имот, в реда на въпросите на собственика:
 * какво е видяно последно (със снимки) → какво предстои → какво чака мен →
 * какъв е абонаментът → какво е правено досега.
 */
export default function PropertyDetail({ property, onBack, onPropertyChanged }: Props) {
  const propertyId = property.id;
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<ClientJob[]>([]);
  const [plans, setPlans] = useState<ClientPlan[]>([]);
  const [findings, setFindings] = useState<ClientFinding[]>([]);
  const [offers, setOffers] = useState<ClientOffer[]>([]);
  const [payments, setPayments] = useState<ClientPayment[]>([]);
  const [showPlanSelector, setShowPlanSelector] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const loadJobs = useCallback(async () => {
    const all = await getOr<ClientJob[]>("/api/jobs", []);
    setJobs(all.filter((j) => j.property_id === propertyId));
  }, [propertyId]);

  const loadPlans = useCallback(async () => {
    setPlans(await getOr<ClientPlan[]>(`/api/properties/${propertyId}/plans`, []));
  }, [propertyId]);

  const loadProblems = useCallback(async () => {
    const [f, o, p] = await Promise.all([
      getOr<ClientFinding[]>(`/api/findings?property_id=${propertyId}`, []),
      getOr<ClientOffer[]>("/api/offers", []),
      getOr<ClientPayment[]>("/api/payments", []),
    ]);
    setFindings(f);
    setOffers(o.filter((x) => x.finding?.property_id === propertyId));
    setPayments(p);
  }, [propertyId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadJobs(), loadPlans(), loadProblems()]).finally(() => setLoading(false));
  }, [loadJobs, loadPlans, loadProblems]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4000);
  };

  const upcoming = useMemo(
    () =>
      jobs
        .filter((j) => j.status === "planned" || j.status === "in_progress")
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === "in_progress" ? -1 : 1;
          return time(a.planned_at) - time(b.planned_at);
        })
        .slice(0, 3),
    [jobs],
  );

  const completed = useMemo(
    () =>
      jobs
        .filter((j) => j.status === "completed")
        .sort((a, b) => time(b.completed_at || b.planned_at) - time(a.completed_at || a.planned_at)),
    [jobs],
  );

  const livePlan = useMemo(() => plans.find((p) => isLivePlan(p, todayKey())) ?? null, [plans]);
  const nextPlanned = upcoming.find((j) => j.status === "planned") ?? null;

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-muted">Зареждане на имота…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 space-y-4 overflow-y-auto px-4 py-4 safe-bottom">
      <PropertyHeader
        property={property}
        onBack={onBack}
        onSaved={(msg) => {
          showToast(msg);
          onPropertyChanged();
        }}
      />

      {toast && (
        <div className="sticky top-2 z-30 rounded-card bg-brand-dark px-3 py-2 text-sm text-white shadow-card-2" role="status">
          {toast}
        </div>
      )}

      <LastVisitSection job={completed[0] ?? null} />

      <UpcomingSection
        jobs={upcoming}
        hasLivePlan={!!livePlan}
        onChanged={(msg) => {
          showToast(msg);
          loadJobs();
        }}
      />

      <FindingsSection
        findings={findings}
        offers={offers}
        payments={payments}
        onChanged={(msg) => {
          showToast(msg);
          loadProblems();
        }}
      />

      <SubscriptionSection
        plan={livePlan}
        approval={property.approval_status}
        nextJob={nextPlanned}
        onChoose={() => setShowPlanSelector(true)}
        onChanged={(msg) => {
          showToast(msg);
          loadPlans();
          loadJobs();
        }}
      />

      <HistorySection jobs={completed.slice(1)} />

      {showPlanSelector && (
        <PlanSelector
          propertyId={propertyId}
          onClose={() => setShowPlanSelector(false)}
          onDone={() => {
            setShowPlanSelector(false);
            loadPlans();
          }}
        />
      )}
    </div>
  );
}
