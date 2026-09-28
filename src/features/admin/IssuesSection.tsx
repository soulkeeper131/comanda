"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatWhen } from "@/lib/format";
import { api } from "./api";
import OfferCard from "./OfferCard";
import OfferSheet from "./OfferSheet";
import { Chips, EmptyState, PhotoStrip, PhotoViewer, SectionTitle } from "./ui";
import type { AdminData, Resource } from "./useAdminData";
import type { AdminFinding } from "./types";

type Filter = "action" | "offers" | "unpaid" | "open" | "closed";

const FINDING_STATUS: Record<AdminFinding["status"], { text: string; tone: "neutral" | "warning" | "info" | "ok" }> = {
  open: { text: "Отворена", tone: "neutral" },
  quote_requested: { text: "Иска оферта", tone: "warning" },
  quoted: { text: "Има оферта", tone: "info" },
  closed: { text: "Затворена", tone: "ok" },
};

const LIVE = ["pending", "accepted", "paid", "in_progress"];

/**
 * Констатации и оферти. Работната опашка е „За действие": спешните и тези,
 * за които клиентът е поискал оферта (въпрос 19). Констатация без заявка е
 * информация за клиента, не висяща задача.
 */
export default function IssuesSection({
  data,
  threshold,
  reload,
  toast,
}: {
  data: AdminData;
  threshold: number;
  reload: (...r: Resource[]) => Promise<void>;
  toast: (text: string, tone?: "ok" | "error") => void;
}) {
  const [filter, setFilter] = useState<Filter>("action");
  const [offerFor, setOfferFor] = useState<AdminFinding | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);

  const buckets = useMemo(
    () => ({
      action: data.findings.filter(
        (f) => f.status === "quote_requested" || (f.severity === "urgent" && f.status === "open"),
      ),
      open: data.findings.filter((f) => f.status !== "closed"),
      closed: data.findings.filter((f) => f.status === "closed"),
      offers: data.offers.filter((o) => LIVE.includes(o.decision)),
      unpaid: data.offers.filter((o) => o.awaits_payment),
    }),
    [data.findings, data.offers],
  );

  const changed = (message: string, tone: "ok" | "error" = "ok") => {
    toast(message, tone);
    if (tone === "ok") reload("offers", "findings");
  };

  const closeFinding = async (f: AdminFinding) => {
    if (!confirm("Да затворя ли констатацията? Клиентът ще я вижда като решена.")) return;
    const res = await api(`/api/findings/${f.id}`, { method: "PATCH", body: { status: "closed" } });
    changed(res.ok ? "Констатацията е затворена" : res.error, res.ok ? "ok" : "error");
  };

  const findingCard = (f: AdminFinding) => {
    const st = FINDING_STATUS[f.status];
    const hasLiveOffer = f.offer && LIVE.includes(f.offer.decision);
    return (
      <Card key={f.id} padding="sm" className={f.severity === "urgent" && f.status !== "closed" ? "border-state-danger/50" : ""}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink">{f.title}</span>
              {f.severity === "urgent" && <Badge tone="danger">Спешно</Badge>}
            </div>
            <div className="text-sm text-muted">
              {f.property_name} · {formatWhen(f.created_at)}
              {f.reporter_name ? ` · ${f.reporter_name}` : ""}
            </div>
            {f.job_item && <div className="text-xs text-muted">Стъпка: {f.job_item.label}</div>}
            {f.body && <p className="mt-1 text-sm text-ink-2">{f.body}</p>}
            <PhotoStrip urls={f.photos.map((p) => p.url)} onOpen={setViewer} />
          </div>
          <Badge tone={st.tone}>{st.text}</Badge>
        </div>
        {f.status !== "closed" && (
          <div className="mt-3 flex flex-wrap gap-2">
            {!hasLiveOffer && (
              <Button size="sm" variant={f.severity === "urgent" ? "danger" : "primary"} onClick={() => setOfferFor(f)}>
                Изготви оферта
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => closeFinding(f)}>
              Затвори
            </Button>
          </div>
        )}
      </Card>
    );
  };

  const showOffers = filter === "offers" || filter === "unpaid";
  const findings = showOffers ? [] : buckets[filter as "action" | "open" | "closed"];
  const offers = filter === "offers" ? buckets.offers : filter === "unpaid" ? buckets.unpaid : [];

  return (
    <div>
      <SectionTitle>Проблеми и оферти</SectionTitle>
      <Chips
        value={filter}
        onChange={setFilter}
        options={[
          { value: "action", label: "За действие", count: buckets.action.length },
          { value: "offers", label: "Оферти в ход", count: buckets.offers.length },
          { value: "unpaid", label: "Чакат плащане", count: buckets.unpaid.length },
          { value: "open", label: "Всички отворени" },
          { value: "closed", label: "Затворени" },
        ]}
      />
      <div className="space-y-2">
        {showOffers &&
          (offers.length === 0 ? (
            <EmptyState icon="wrench" title="Няма оферти тук" />
          ) : (
            offers.map((o) => <OfferCard key={o.id} offer={o} onChanged={changed} onOpenPhoto={setViewer} />)
          ))}
        {!showOffers &&
          (findings.length === 0 ? (
            <EmptyState
              icon="check-circle"
              title={filter === "action" ? "Нищо не чака оферта" : "Няма констатации тук"}
            />
          ) : (
            findings.map(findingCard)
          ))}
      </div>

      <OfferSheet
        finding={offerFor}
        threshold={threshold}
        onClose={() => setOfferFor(null)}
        onCreated={(m) => {
          setOfferFor(null);
          changed(m);
        }}
      />
      <PhotoViewer url={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}
