"use client";

import { useEffect, useState } from "react";
import type { Property } from "./types";

interface MapViewProps {
  properties: Property[];
  onPropertyClick: (p: Property) => void;
}

export default function MapView({ properties, onPropertyClick }: MapViewProps) {
  const [L, setL] = useState<any>(null);
  const [map, setMap] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const leaflet = await import("leaflet");
      if (cancelled) return;
      setL(leaflet);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!L || map) return;

    const m = L.map("map-container", {
      center: [42.6977, 23.3219],
      zoom: 13,
      zoomControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(m);

    setMap(m);

    return () => {
      m.remove();
    };
  }, [L]);

  useEffect(() => {
    if (!L || !map) return;

    // Clear old markers
    map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) map.removeLayer(layer);
    });

    properties.forEach((p) => {
      const color = p.status === "ok" ? "#22c55e" : p.status === "warn" ? "#f59e0b" : "#ef4444";

      const icon = L.divIcon({
        className: "custom-marker",
        html: `<div style="
          width:28px;height:28px;border-radius:50%;background:${color};
          border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.25);
          display:flex;align-items:center;justify-content:center;
          font-size:12px;color:#fff;font-weight:bold;
        ">${p.status === "ok" ? "✓" : p.status === "warn" ? "!" : "✕"}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
      });

      const marker = L.marker([p.lat, p.lng], { icon }).addTo(map);

      const popup = L.popup({ offset: [0, -10], closeButton: false }).setContent(
        `<div style="font-family:system-ui,sans-serif;cursor:pointer;min-width:120px">
          <div style="font-weight:700;font-size:13px;color:#006494">${p.name}</div>
          <div style="font-size:11px;color:#666;margin-top:2px">${p.address}</div>
        </div>`
      );

      marker.bindPopup(popup);

      marker.on("click", () => {
        onPropertyClick(p);
      });
    });
  }, [L, map, properties, onPropertyClick]);

  return <div id="map-container" style={{ width: "100%", height: "100%", background: "#e8f1f2" }} />;
}
