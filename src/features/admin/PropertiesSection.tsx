"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { fullAddress } from "@/lib/format";
import PropertyEditorSheet, { APPROVAL } from "./PropertyEditorSheet";
import NewPropertySheet from "./NewPropertySheet";
import { Chips, EmptyState, SectionTitle, inputClass } from "./ui";
import type { AdminData, Resource } from "./useAdminData";
import type { AdminProperty } from "./types";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

type Filter = "all" | "pending" | "no_inspector" | "rejected";

const OPERATIONAL: Record<string, { text: string; tone: "ok" | "info" | "warning" | "danger" }> = {
  ok: { text: "Наред", tone: "ok" },
  in_progress: { text: "Обход в момента", tone: "info" },
  warning: { text: "Констатация", tone: "warning" },
  overdue: { text: "Просрочен обход", tone: "danger" },
};

export default function PropertiesSection({
  data,
  reload,
  toast,
  focusId,
  onFocused,
}: {
  data: AdminData;
  reload: (...r: Resource[]) => Promise<void>;
  toast: (text: string, tone?: "ok" | "error") => void;
  /** Отваря редактора на този имот (от опашките на таблото). */
  focusId: string | null;
  onFocused: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "map">("list");
  const [editing, setEditing] = useState<AdminProperty | null>(null);
  const [creating, setCreating] = useState(false);
  const inspectors = data.users.filter((u) => u.role === "inspector" && u.active);
  const clients = data.users.filter((u) => u.role === "client" && u.active);

  useEffect(() => {
    if (!focusId) return;
    const p = data.properties.find((x) => x.id === focusId);
    if (p) setEditing(p);
    onFocused();
  }, [focusId, data.properties, onFocused]);

  const planByProperty = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of data.plans) {
      if (p.status === "active" || p.status === "requested") m.set(p.property_id, p.package_name || p.name);
    }
    return m;
  }, [data.plans]);

  const counts = {
    pending: data.properties.filter((p) => p.approval_status === "pending").length,
    no_inspector: data.properties.filter((p) => p.approval_status === "active" && !p.assigned_inspector_id).length,
    rejected: data.properties.filter((p) => p.approval_status === "rejected").length,
  };

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.properties
      .filter((p) => {
        if (filter === "pending") return p.approval_status === "pending";
        if (filter === "rejected") return p.approval_status === "rejected";
        if (filter === "no_inspector") return p.approval_status === "active" && !p.assigned_inspector_id;
        return p.approval_status !== "rejected";
      })
      .filter((p) => !q || `${p.name} ${p.address} ${p.owner_name} ${p.city}`.toLowerCase().includes(q))
      .sort((a, b) => (a.approval_status === "pending" ? -1 : 0) - (b.approval_status === "pending" ? -1 : 0) || a.name.localeCompare(b.name, "bg"));
  }, [data.properties, filter, search]);

  return (
    <div>
      <SectionTitle
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setView(view === "list" ? "map" : "list")}>
              <Icon name={view === "list" ? "map" : "list"} size={16} /> {view === "list" ? "Карта" : "Списък"}
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Icon name="plus" size={16} /> Имот
            </Button>
          </div>
        }
      >
        Имоти
      </SectionTitle>
      <Chips
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "Всички" },
          { value: "pending", label: "За одобрение", count: counts.pending },
          { value: "no_inspector", label: "Без инспектор", count: counts.no_inspector },
          { value: "rejected", label: "Отказани", count: counts.rejected },
        ]}
      />
      <input className={`${inputClass} mb-3`} placeholder="Търси по име, адрес или собственик" value={search} onChange={(e) => setSearch(e.target.value)} />

      {view === "map" ? (
        <div className="h-[60dvh] overflow-hidden rounded-card border border-line">
          <MapView
            points={list.map((p) => ({ id: p.id, name: p.name, address: p.address, lat: p.lat, lng: p.lng, status: p.status }))}
            onSelect={(id) => setEditing(data.properties.find((p) => p.id === id) ?? null)}
          />
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon="home" title="Няма имоти тук" />
      ) : (
        <div className="space-y-2">
          {list.map((p) => {
            const approval = APPROVAL[p.approval_status];
            const op = OPERATIONAL[p.status];
            return (
              <button key={p.id} onClick={() => setEditing(p)} className="block w-full text-left">
                <Card padding="sm" className="transition hover:shadow-card-2">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-ink">{p.name}</div>
                      <div className="truncate text-sm text-muted">{fullAddress(p.city, p.address)}</div>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
                        <span>{p.owner_name}</span>
                        <span>{p.inspector_name ? `Инспектор: ${p.inspector_name}` : "Без инспектор"}</span>
                        {planByProperty.get(p.id) && <span>Пакет: {planByProperty.get(p.id)}</span>}
                      </div>
                    </div>
                    {p.approval_status !== "active" ? (
                      <Badge tone={approval.tone}>{approval.text}</Badge>
                    ) : (
                      op && <Badge tone={op.tone}>{op.text}</Badge>
                    )}
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      <PropertyEditorSheet
        property={editing}
        inspectors={inspectors}
        onClose={() => setEditing(null)}
        onChanged={(m) => {
          setEditing(null);
          toast(m);
          reload("properties", "plans");
        }}
      />
      <NewPropertySheet
        open={creating}
        clients={clients}
        onClose={() => setCreating(false)}
        onCreated={(m) => {
          setCreating(false);
          toast(m);
          reload("properties");
        }}
      />
    </div>
  );
}
