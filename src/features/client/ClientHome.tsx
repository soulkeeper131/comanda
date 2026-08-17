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

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/properties");
      if (!res.ok) throw new Error("failed");
      const data: ClientProperty[] = await res.json();
      setProperties(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
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
        <button onClick={load} className="text-sm font-semibold text-brand-primary">
          Опитайте отново
        </button>
      </div>
    );
  }

  if (properties.length === 0) {
    return <EmptyPropertyState onCreated={load} />;
  }

  if (properties.length === 1) {
    return <PropertyDetail propertyId={properties[0].id} propertyName={properties[0].name} />;
  }

  const selected = selectedId ? properties.find((p) => p.id === selectedId) : null;
  if (selected) {
    return (
      <PropertyDetail
        propertyId={selected.id}
        propertyName={selected.name}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return <PropertyList properties={properties} onSelect={setSelectedId} />;
}
