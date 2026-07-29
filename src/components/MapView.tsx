"use client";

import { useEffect, useRef, useState } from "react";
import { mockProperties, Property, getStatusColor, getStatusLabel } from "@/lib/mock-data";
import Link from "next/link";

// Dynamic Leaflet import to avoid SSR issues
let L: any = null;

export default function MapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Property | null>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (mapInstance.current) return;

    import("leaflet").then((leaflet) => {
      L = leaflet.default;
      if (!mapRef.current) return;

      // Fix Leaflet icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current).setView([42.66, 23.33], 12);
      mapInstance.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
      }).addTo(map);

      // Add markers
      mockProperties.forEach((p) => {
        const color = getStatusColor(p.status);
        const icon = L.divIcon({
          html: `<div style="
            width: 14px; height: 14px; border-radius: 50%; background: ${color};
            border: 3px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          "></div>`,
          className: "",
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

        const marker = L.marker([p.lat, p.lng], { icon })
          .addTo(map)
          .on("click", () => setSelected(p));

        marker.bindTooltip(p.name, {
          direction: "top",
          offset: [0, -12],
          className: "map-tooltip",
        });

        markersRef.current.push(marker);
      });
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  return (
    <div className="relative flex-1">
      <div ref={mapRef} className="h-full w-full" style={{ minHeight: 300 }} />

      {/* Property Sheet */}
      {selected && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />
          <div className="sheet on" style={{
            position: "fixed", bottom: 0, left: 0, right: 0,
            zIndex: 50, background: "#fff", borderTopLeftRadius: 20,
            borderTopRightRadius: 20, boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
            maxHeight: "90dvh", display: "flex", flexDirection: "column",
            maxWidth: 620, margin: "0 auto",
          }}>
            <div className="sheet-grip" style={{
              width: 38, height: 4, borderRadius: 99, background: "#D8DEE6",
              margin: "10px auto 2px", flexShrink: 0,
            }} />
            <div className="sheet-head" style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              padding: "10px 18px 14px", borderBottom: "1px solid #e4e9f0", flexShrink: 0,
            }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink, #0f172a)" }}>
                  {selected.name}
                </h3>
                <p style={{ fontSize: 13, color: "#247ba0", marginTop: 2 }}>
                  {selected.address}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="x"
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "#e4e9f0", display: "grid", placeItems: "center",
                  color: "#247ba0", fontSize: 15, flexShrink: 0,
                  marginLeft: "auto", border: "none", cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <div className="sheet-body" style={{
              overflowY: "auto", padding: "16px 18px calc(20px + env(safe-area-inset-bottom))",
            }}>
              {/* Status */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10, marginBottom: 18,
                padding: "12px 16px", borderRadius: 14, fontSize: 13.5, fontWeight: 600,
                background: selected.status === "ok" ? "#f0fdf4" : selected.status === "due" ? "#fff7ed" : "#fef2f2",
                border: `1px solid ${selected.status === "ok" ? "#bbf7d0" : selected.status === "due" ? "#fed7aa" : "#fecaca"}`,
                color: selected.status === "ok" ? "#166534" : selected.status === "due" ? "#9a3412" : "#991b1b",
              }}>
                <span style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: getStatusColor(selected.status),
                }} />
                {getStatusLabel(selected.status)}
                {selected.lastVisit && (
                  <span style={{ marginLeft: "auto", fontWeight: 400, opacity: 0.8 }}>
                    Последно: {selected.lastVisit}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="vrow" style={{
                display: "flex", alignItems: "center", gap: 11,
                padding: "11px 0", borderBottom: "1px solid #e4e9f0",
                fontSize: 14, color: "#006494",
              }}>
                <span>👤</span> {selected.owner}
              </div>
              <div className="vrow" style={{
                display: "flex", alignItems: "center", gap: 11,
                padding: "11px 0", borderBottom: "1px solid #e4e9f0",
                fontSize: 14, color: "#006494",
              }}>
                <span>🏷️</span> {selected.kind === "apartment" ? "Апартамент" :
                  selected.kind === "house" ? "Къща" :
                  selected.kind === "studio" ? "Студио" :
                  selected.kind === "office" ? "Офис" :
                  selected.kind === "maisonette" ? "Мезонет" : selected.kind}
              </div>

              {/* Zones */}
              <div className="zone-h" style={{
                display: "flex", alignItems: "center", gap: 9,
                margin: "20px 2px 9px", fontSize: 13, fontWeight: 700,
                color: "#006494",
              }}>
                <span className="zi" style={{
                  width: 24, height: 24, borderRadius: 8,
                  background: "rgba(27,152,224,0.12)", display: "grid",
                  placeItems: "center", fontSize: 12,
                }}>📍</span>
                Зони
                <span className="zc" style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 600, color: "#247ba0" }}>
                  {selected.zones.length} зони
                </span>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {selected.zones.map((z) => (
                  <span key={z} style={{
                    padding: "5px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 550,
                    background: "rgba(27,152,224,0.08)", color: "#006494",
                    border: "1px solid rgba(27,152,224,0.15)",
                  }}>
                    {z}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
