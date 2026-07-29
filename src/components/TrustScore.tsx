"use client";

import { useState } from "react";

export type TrustScoreDetail = {
  label: string;
  value: number;
  max: number;
};

export type TrustScoreProps = {
  score: number;
  maxScore: number;
  details: TrustScoreDetail[];
};

function getColor(ratio: number): { ring: string; bg: string } {
  if (ratio >= 0.8) return { ring: "#16a34a", bg: "#dcfce7" };
  if (ratio >= 0.5) return { ring: "#d97706", bg: "#fef3c7" };
  return { ring: "#dc2626", bg: "#fee2e2" };
}

function DetailBar({ detail }: { detail: TrustScoreDetail }) {
  const pct = Math.round((detail.value / detail.max) * 100);
  const { ring } = getColor(detail.value / detail.max);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#006494" }}>{detail.label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: ring }}>
          {detail.value}/{detail.max}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "#e4e9f0", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 3,
            background: ring,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

export default function TrustScore({ score, maxScore, details }: TrustScoreProps) {
  const [expanded, setExpanded] = useState(false);
  const ratio = maxScore > 0 ? score / maxScore : 0;
  const pct = Math.round(ratio * 100);
  const { ring, bg } = getColor(ratio);

  const circumference = 2 * Math.PI * 42; // r=42
  const offset = circumference * (1 - ratio);

  return (
    <div
      style={{
        border: "1px solid #d0e5ff",
        borderRadius: 16,
        background: "#f8faff",
        padding: 16,
        marginBottom: 16,
      }}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        {/* Score ring */}
        <div style={{ position: "relative", width: 96, height: 96, flexShrink: 0 }}>
          <svg width={96} height={96} style={{ transform: "rotate(-90deg)" }}>
            {/* Background ring */}
            <circle
              cx={48}
              cy={48}
              r={42}
              fill="none"
              stroke="#e4e9f0"
              strokeWidth={8}
            />
            {/* Progress ring */}
            <circle
              cx={48}
              cy={48}
              r={42}
              fill="none"
              stroke={ring}
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 22, fontWeight: 800, color: ring, lineHeight: 1 }}>
              {pct}%
            </span>
            <span style={{ fontSize: 9, color: "#247ba0", fontWeight: 600 }}>
              Trust
            </span>
          </div>
        </div>

        {/* Summary text */}
        <div style={{ textAlign: "left", flex: 1 }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#006494" }}>
            🛡️ Trust Score
          </h4>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#247ba0" }}>
            {ratio >= 0.8
              ? "Високо ниво на доверие"
              : ratio >= 0.5
                ? "Средно ниво на доверие"
                : "Ниско ниво на доверие"}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#1b98e0" }}>
            {expanded ? "▾ Скрий детайли" : "▸ Виж детайли"}
          </p>
        </div>
      </button>

      {/* Expandable details */}
      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #d0e5ff" }}>
          {details.map((d) => (
            <DetailBar key={d.label} detail={d} />
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 8,
              paddingTop: 8,
              borderTop: "1px solid #d0e5ff",
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: "#006494" }}>
              Общ Trust Score
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, color: ring }}>
              {score}/{maxScore}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
