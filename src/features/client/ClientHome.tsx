"use client";

import { useEffect, useState, useCallback } from "react";
import EmptyPropertyState from "./EmptyPropertyState";
import PropertyList from "./PropertyList";
import PropertyDetail from "./PropertyDetail";
import type { ClientProperty } from "./types";

/**
 * Клиентският дом ("Моят имот" — Task 20). Заменя таб-базирания dashboard
 * за роля client. Клиентът вижда имота си, не табове:
 *   - 0 имота  → покана да добави първия (основният случай за нов клиент).
 *   - 1 имот   → директно неговия екран.
 *   - N имота  → компактен списък, клик отваря същия екран.
 */
export default function ClientHome() {
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<ClientProperty[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  // silent: презареждане без да сменяме екрана с „Зареждане…"
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/properties");
      if (!res.ok) throw new Error("failed");
      const data: ClientProperty[] = await res.json();
      setProperties(data);
    } catch {
      if (!silent) setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Връщане от Stripe (?payment=plan-ok / plan-cancel) — казваме какво стана
  // и чистим адреса. Webhook-ът може да закъснее с секунди, затова и
  // презареждане след малко.
  const [returnNotice, setReturnNotice] = useState<string | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("payment");
    if (!p) return;
    setReturnNotice(
      p === "plan-ok"
        ? "Плащането е прието. Ще се свържем с вас, за да уговорим първия обход."
        : p === "order-ok"
          ? "Плащането е прието — услугата е насрочена."
          : p === "order-cancel"
            ? "Плащането не беше завършено. Заявката чака в „Допълнителни услуги“."
            : "Плащането не беше завършено. Можете да опитате отново от „Абонамент“.",
    );
    window.history.replaceState(null, "", window.location.pathname);
    const t = setTimeout(load, 4000);
    return () => clearTimeout(t);
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-muted">Зареждане на имота ви…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-ink">Възникна грешка при зареждане.</p>
        <button onClick={() => load()} className="min-h-touch text-sm font-semibold text-brand-primary">
          Опитайте отново
        </button>
      </div>
    );
  }

  const selected = selectedId ? properties.find((p) => p.id === selectedId) : null;
  const view =
    properties.length === 0 ? (
      <EmptyPropertyState onCreated={() => load(true)} />
    ) : properties.length === 1 ? (
      <PropertyDetail property={properties[0]} onPropertyChanged={() => load(true)} />
    ) : selected ? (
      <PropertyDetail
        key={selected.id}
        property={selected}
        onPropertyChanged={() => load(true)}
        onBack={() => setSelectedId(null)}
      />
    ) : (
      <PropertyList properties={properties} onSelect={setSelectedId} />
    );

  return (
    <>
      {returnNotice && (
        <button
          onClick={() => setReturnNotice(null)}
          className="mx-4 mt-3 rounded-card bg-brand-dark px-4 py-3 text-left text-sm font-semibold text-white"
        >
          {returnNotice}
        </button>
      )}
      {view}
    </>
  );
}
