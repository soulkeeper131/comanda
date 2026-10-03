"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";

export type MapPoint = {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  /** ok | in_progress | warning | overdue | pending | rejected */
  status: string;
};

const STATUS: Record<string, { color: string; label: string }> = {
  ok: { color: "#16a34a", label: "Всичко е наред" },
  in_progress: { color: "#1b98e0", label: "Обход в момента" },
  warning: { color: "#d97706", label: "Отворена констатация" },
  overdue: { color: "#dc2626", label: "Просрочен обход" },
  pending: { color: "#a663cc", label: "Чака одобрение" },
  rejected: { color: "#94a3b8", label: "Отказан" },
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Карта на имотите (Leaflet + OpenStreetMap). Името и адресът идват от
 * клиента — затова минават през escapeHtml, преди да влязат в popup-а.
 */
export default function MapView({ points, onSelect }: { points: MapPoint[]; onSelect: (id: string) => void }) {
  const [L, setL] = useState<typeof Leaflet | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((mod) => {
      if (!cancelled) setL(mod);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!L || !containerRef.current || mapRef.current) return;
    const m = L.map(containerRef.current, { center: [42.6977, 23.3219], zoom: 12 });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(m);
    layerRef.current = L.layerGroup().addTo(m);
    setTimeout(() => m.invalidateSize(), 100);
    mapRef.current = m;
    return () => {
      m.remove();
      mapRef.current = null;
    };
  }, [L]);

  useEffect(() => {
    const m = mapRef.current;
    const layer = layerRef.current;
    if (!L || !m || !layer) return;
    layer.clearLayers();
    for (const p of points) {
      const st = STATUS[p.status] ?? STATUS.ok;
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: 11,
        fillColor: st.color,
        color: "#fff",
        weight: 3,
        fillOpacity: 0.9,
      });
      marker.bindTooltip(
        `<strong>${escapeHtml(p.name)}</strong><br/>${escapeHtml(p.address ?? "")}<br/><span style="color:${st.color}">${st.label}</span>`,
      );
      marker.on("click", () => onSelectRef.current(p.id));
      marker.addTo(layer);
    }
    if (points.length > 0) {
      m.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 15 });
    }
  }, [L, points]);

  return <div ref={containerRef} className="h-full w-full" style={{ minHeight: 360 }} />;
}
