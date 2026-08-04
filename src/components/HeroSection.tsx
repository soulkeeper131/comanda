"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const PLANS = [
  {
    key: "year",
    icon: "🔄",
    name: "Пълен надзор",
    price: "60€",
    period: "/месец",
    desc: "12 месеца грижа. Чек-листът се сменя според сезона.",
    features: ["2 обхода месечно", "Присъствие при майстор", "Приоритет 24/7"],
  },
  {
    key: "winter",
    icon: "❄️",
    name: "Зимен сезон",
    price: "40€",
    period: "/месец",
    desc: "Октомври – Април. Проветряване, влага, отопление.",
    features: ["2 обхода месечно", "Проверка за мухъл и течове", "Прибиране на пощата"],
  },
  {
    key: "summer",
    icon: "☀️",
    name: "Летен сезон",
    price: "50€",
    period: "/месец",
    desc: "Май – Септември. Бури, жега, двор и тераса.",
    features: ["2 обхода месечно", "Проверка след буря", "Поливане при заявка"],
  },
];

export default function HeroSection() {
  const [modalOpen, setModalOpen] = useState(false);

  // Close on Escape + lock body scroll
  useEffect(() => {
    if (!modalOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [modalOpen]);

  return (
    <header className="l-hero">
      <div className="l-wrap l-hero-in">
        <div className="l-badge">
          <span className="d" />Активен обход — Драгалевци, 10:34
        </div>
        <h1 className="l-h1">
          Имотът ти стои празен.
          <br />
          <em>Не и без надзор.</em>
        </h1>
        <p className="l-sub">
          Грижа за вакантни жилища, докато собственикът е в друг град или друга държава.
          Редовни обходи, проветряване, проверка за течове и влага, зимна консервация
          и организиране на ремонтите. Всеки обход излиза със снимки, час и потвърдена локация.
        </p>
        <div className="l-cta">
          <button
            onClick={() => setModalOpen(true)}
            className="l-btn l-btn-p"
          >
            Избери пакет →
          </button>
          <Link href="#contact" className="l-btn l-btn-g">
            Изпрати запитване
          </Link>
        </div>
        <p className="l-note">
          Ядрото ни е грижата за празния имот. Ако след време ти потрябва
          и пълноценно управление — отдаване, наематели, счетоводство — говорим и за това.
        </p>

        <div className="l-strip">
          <div>
            <div className="n">2×</div>
            <div className="l">обхода месечно по абонамент</div>
          </div>
          <div>
            <div className="n">100%</div>
            <div className="l">обходи със снимков отчет</div>
          </div>
          <div>
            <div className="n">±75 м</div>
            <div className="l">потвърждение на локацията по GPS</div>
          </div>
          <div>
            <div className="n">24 ч</div>
            <div className="l">до оферта при открит проблем</div>
          </div>
        </div>
      </div>

      {/* ===== POPUP ===== */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.45)" }}
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85dvh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold" style={{ color: "#006494" }}>
                Избери пакет
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition text-xl"
                style={{ color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 mb-6">
              {PLANS.map((plan) => (
                <Link
                  key={plan.key}
                  href={`/register?plan=${plan.key}`}
                  className="block bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-[#1b98e0] transition-all group"
                  onClick={() => setModalOpen(false)}
                >
                  <div className="text-3xl mb-3">{plan.icon}</div>
                  <h3 className="font-bold text-lg mb-1" style={{ color: "#006494" }}>
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-2xl font-extrabold" style={{ color: "#1b98e0" }}>
                      {plan.price}
                    </span>
                    <span className="text-sm" style={{ color: "#64748b" }}>
                      {plan.period}
                    </span>
                  </div>
                  <p className="text-sm mb-3" style={{ color: "#475569" }}>
                    {plan.desc}
                  </p>
                  <ul className="space-y-1">
                    {plan.features.map((f) => (
                      <li key={f} className="text-xs flex items-center gap-1.5" style={{ color: "#64748b" }}>
                        <span style={{ color: "#22c55e" }}>✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 py-2.5 text-center rounded-xl text-sm font-semibold text-white transition group-hover:opacity-90"
                    style={{ background: "linear-gradient(140deg, #1b98e0, #006494)" }}>
                    Избери
                  </div>
                </Link>
              ))}
            </div>

            {/* По заявка */}
            <a
              href="#contact"
              onClick={() => setModalOpen(false)}
              className="block border-2 border-dashed rounded-xl p-4 text-center hover:bg-purple-50 hover:border-[#a663cc] transition-all"
              style={{ borderColor: "var(--accent)" }}
            >
              <div className="text-2xl mb-2">✎</div>
              <h3 className="font-bold text-lg" style={{ color: "#006494" }}>
                По заявка
              </h3>
              <p className="text-sm mt-1" style={{ color: "#64748b" }}>
                Не намираш това, което ти трябва? Опиши какво искаш — връщаме ти оферта до 24 часа.
              </p>
              <div className="inline-block mt-3 py-2 px-6 rounded-xl text-sm font-semibold transition"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                Опиши и получи оферта →
              </div>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
