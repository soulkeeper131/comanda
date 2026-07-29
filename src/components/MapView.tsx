"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { Property } from "./types";

interface MapViewProps {
  properties: Property[];
  onPropertyClick: (p: Property) => void;
}

const STATUS_COLORS: Record<string, string> = {
  ok: "#22c55e",
  warn: "#f59e0b",
  bad: "#ef4444",
};

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
      // Don't set touchAction — Leaflet handles gestures internally
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(m);

    // Fix missing tiles on resize
    setTimeout(() => m.invalidateSize(), 100);

    mapRef.current = m;

    return () => {
      m.remove();
      mapRef.current = null;
    };
  }, [L]);

  // Stable callback ref to avoid re-rendering markers on every click handler change
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
      const color = STATUS_COLORS[p.status] || "#22c55e";

      // CircleMarker — SVG-based, works reliably on mobile
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: 22,
        fillColor: color,
        color: "#fff",
        weight: 3,
        opacity: 1,
        fillOpacity: 0.9,
      }).addTo(m);

      // Click → open PropertySheet
      marker.on("click", () => {
        onClickRef.current(p);
      });

      // Popup with property name
      marker.bindPopup(
        `<div style="font-family:system-ui,sans-serif;min-width:100px;text-align:center">
          <div style="font-weight:700;font-size:13px;color:#006494">${p.name}</div>
          <div style="font-size:11px;color:#666;margin-top:3px">${p.address?.split(",")[0] || ""}</div>
        </div>`,
        {
          closeButton: false,
          className: "property-popup",
        }
      );
    });
  }, [L, properties]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ background: "#e8f1f2", minHeight: "300px" }}
    />
  );
}
