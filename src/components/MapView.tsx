"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { Property } from "./types";

interface MapViewProps {
  properties: Property[];
  onPropertyClick: (p: Property) => void;
}

const STATUS = {
  ok:   { color: "#22c55e", emoji: "✓", label: "Активен" },
  warn: { color: "#f59e0b", emoji: "⏳", label: "Предстои" },
  bad:  { color: "#ef4444", emoji: "⚠", label: "Просрочен" },
} as const;

const KIND_ICON: Record<string, string> = {
  apartment: "🏢", house: "🏠", studio: "🛏️", villa: "🏡",
};

function daysAgo(iso: string): string {
  if (!iso) return "—";
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "днес";
  if (d === 1) return "вчера";
  if (d < 7) return `преди ${d} дни`;
  return new Date(iso).toLocaleDateString("bg-BG");
}

export default function MapView({ properties, onPropertyClick }: MapViewProps) {
  const [L, setL] = useState<any>(null);
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load Leaflet once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const leaflet = await import("leaflet");
      if (cancelled) return;
      setL(leaflet);
    })();
    return () => { cancelled = true; };
  }, []);

  // Init map
  useEffect(() => {
    if (!L || mapRef.current) return;

    const m = L.map(containerRef.current!, {
      center: [42.6977, 23.3219],
      zoom: 13,
      zoomControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(m);

    setTimeout(() => m.invalidateSize(), 100);
    mapRef.current = m;

    return () => {
      m.remove();
      mapRef.current = null;
    };
  }, [L]);

  // Stable callback
  const onClickRef = useRef(onPropertyClick);
  onClickRef.current = onPropertyClick;

  // Update markers
  useEffect(() => {
    const m = mapRef.current;
    if (!L || !m) return;

    // Remove old markers
    m.eachLayer((layer: any) => {
      if (layer instanceof L.CircleMarker) m.removeLayer(layer);
    });

    properties.forEach((p) => {
      const st = STATUS[p.status] || STATUS.ok;
      const icon = KIND_ICON[p.kind] || "📍";
      const addr = (p.address || "").split(",")[0];
      const zoneCount = p.zones?.length || 0;

      const marker = L.circleMarker([p.lat, p.lng], {
        radius: 16,
        fillColor: st.color,
        color: "#fff",
        weight: 3,
        opacity: 1,
        fillOpacity: 0.85,
      }).addTo(m);

      // Smart popup
      marker.bindPopup(
        `<div class="map-popup-content">
          <div class="map-popup-status" style="background:${st.color}15;color:${st.color}">
            ${st.emoji} ${st.label}
          </div>
          <div class="map-popup-name">${icon} ${p.name}</div>
          <div class="map-popup-addr">${addr}</div>
          <div class="map-popup-meta">
            <span>📅 ${daysAgo(p.lastVisit)}</span>
            <span>📋 ${zoneCount} зони</span>
          </div>
          <div class="map-popup-detail-btn" data-prop-id="${p.id}">
            Подробности →
          </div>
        </div>`,
        {
          className: "smart-popup",
          closeButton: false,
          autoPan: true,
        }
      );

      // Click marker → open PropertySheet
      marker.on("click", () => {
        onClickRef.current(p);
      });

      // Popup "Подробности" button — handled via delegation on map container
    });

    // Delegate popup button clicks
    const handlePopupClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("map-popup-detail-btn")) {
        const propId = target.getAttribute("data-prop-id");
        const prop = properties.find(p => p.id === propId);
        if (prop) onClickRef.current(prop);
      }
    };
    m.getContainer().addEventListener("click", handlePopupClick);

    return () => {
      m.getContainer()?.removeEventListener("click", handlePopupClick);
    };
  }, [L, properties]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ background: "#e8f1f2", minHeight: "300px" }}
    />
  );
}
