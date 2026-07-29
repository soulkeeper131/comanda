"use client";

import Topbar from "@/components/Topbar";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-[100dvh]" style={{ backgroundColor: "#e8f1f2" }}>
      <Topbar />

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Tabs */}
        <div className="flex gap-0 border-b bg-white/70 backdrop-blur-sm px-2 overflow-x-auto"
          style={{ borderColor: "#e4e9f0" }}>
          {["🗺️ Карта", "📋 Задачи", "🔧 Ремонти", "🏠 Обекти", "📊 История"].map((tab, i) => (
            <button
              key={tab}
              className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition ${
                i === 0 ? "border-current" : "border-transparent"
              }`}
              style={{
                color: i === 0 ? "#1b98e0" : "#247ba0",
                fontSize: "14px",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Map placeholder */}
        <div className="m-4 rounded-2xl overflow-hidden border shadow-sm bg-white"
          style={{ height: "calc(100dvh - 230px)", borderColor: "#e4e9f0" }}>
          <div className="h-full flex items-center justify-center text-center p-8">
            <div>
              <div className="text-4xl mb-4">🗺️</div>
              <h3 className="text-lg font-bold mb-2" style={{ color: "#006494" }}>
                Карта на обектите
              </h3>
              <p className="text-sm max-w-xs leading-relaxed" style={{ color: "#247ba0" }}>
                Тук ще се показват всички имоти с маркери — зелени (наскоро проверени),
                оранжеви (предстои обход) и червени (просрочени).
              </p>
              <Link
                href="/"
                className="inline-block mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition"
                style={{
                  background: "linear-gradient(140deg, #1b98e0, #006494)",
                }}
              >
                ← Към сайта
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
