"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type UserRole = "admin" | "client" | "inspector";

interface Step {
  emoji: string;
  title: string;
  description: string;
}

const STEPS: Record<UserRole, Step[]> = {
  admin: [
    { emoji: "🏠", title: "Добави имот", description: "Регистрирай първия имот в системата, задай локация и собственик." },
    { emoji: "📋", title: "Създай шаблон", description: "Дефинирай чек-лист за обходите — почистване, инспекция, ремонт." },
    { emoji: "📅", title: "Възложи обход", description: "Планирай първия обход, избери шаблон и назначи изпълнител." },
  ],
  client: [
    { emoji: "🏠", title: "Разгледай имотите си", description: "Виж всичките си имоти на картата и в списъка." },
    { emoji: "⚠️", title: "Виж констатациите", description: "Прегледай докладваните проблеми и снимки от обходите." },
    { emoji: "💰", title: "Приеми оферта", description: "Разгледай и приеми оферти за ремонт от администратора." },
  ],
  inspector: [
    { emoji: "🏠", title: "Виж имотите", description: "Разгледай възложените ти имоти на картата и в списъка." },
    { emoji: "▶️", title: "Започни обход", description: "Стартирай инспекция и попълни чек-листа със снимки." },
    { emoji: "📊", title: "Прегледай историята", description: "Виж предишните си обходи и техните резултати." },
  ],
};

const ROLE_EMOJI: Record<string, string> = {
  admin: "🛡️",
  client: "🏡",
  inspector: "🔍",
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Администратор",
  client: "Клиент",
  inspector: "Инспектор",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.role) {
          setRole(data.role as UserRole);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const steps = role ? STEPS[role] : STEPS.admin;
  const step = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setDone(true);
    }
  };

  const handleFinish = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("onboarding_done", "true");
    }
    window.location.href = "/dashboard";
  };

  if (loading) {
    return (
      <div
        className="flex flex-col h-[100dvh] items-center justify-center"
        style={{ backgroundColor: "#e8f1f2" }}
      >
        <div className="text-lg" style={{ color: "#247ba0" }}>
          Зареждане...
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-[100dvh] items-center justify-center px-6"
      style={{ backgroundColor: "#e8f1f2" }}
    >
      {/* Logo / Brand */}
      <div className="mb-8 text-center">
        <img
          src="/logo.png"
          alt="КОМАНДА"
          className="h-24 w-auto mx-auto mb-3"
        />
        <h1
          className="text-2xl font-extrabold"
          style={{ color: "#006494" }}
        >
          Добре дошъл!
        </h1>
        {role && (
          <p
            className="text-sm font-semibold mt-1 flex items-center justify-center gap-1.5"
            style={{ color: "#247ba0" }}
          >
            <span>{ROLE_EMOJI[role]}</span>
            <span>{ROLE_LABEL[role]}</span>
          </p>
        )}
      </div>

      {/* Step Card */}
      {step && !done && (
        <>
          <div
            className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm text-center"
            style={{ borderColor: "#e4e9f0" }}
          >
            <div className="text-5xl mb-4">{step.emoji}</div>
            <h2
              className="text-xl font-bold mb-2"
              style={{ color: "#006494" }}
            >
              {step.title}
            </h2>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "#247ba0" }}
            >
              {step.description}
            </p>
          </div>

          {/* Step dots */}
          <div className="flex gap-2 mt-5 mb-6">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className="w-2.5 h-2.5 rounded-full transition"
                style={{
                  background:
                    idx === currentStep ? "#1b98e0" : "#d1d5db",
                }}
              />
            ))}
          </div>

          {/* Next button */}
          <button
            onClick={handleNext}
            className="w-full max-w-sm min-h-[48px] py-3 rounded-xl text-base font-bold text-white transition hover:opacity-90 active:scale-[0.98]"
            style={{
              background: "linear-gradient(140deg, #1b98e0, #006494)",
            }}
          >
            {currentStep < steps.length - 1 ? "Напред ➡️" : "Готово ✅"}
          </button>
        </>
      )}

      {/* Done state */}
      {done && (
        <div className="text-center">
          <div className="text-6xl mb-4">🚀</div>
          <h2
            className="text-xl font-bold mb-2"
            style={{ color: "#006494" }}
          >
            Готов си да започнеш!
          </h2>
          <p
            className="text-sm mb-6 max-w-xs"
            style={{ color: "#247ba0" }}
          >
            Вече знаеш основните стъпки. Можеш да се върнеш към onboarding
            по всяко време от менюто.
          </p>
          <button
            onClick={handleFinish}
            className="w-full max-w-sm min-h-[48px] py-3 rounded-xl text-base font-bold text-white transition hover:opacity-90 active:scale-[0.98]"
            style={{
              background: "linear-gradient(140deg, #1b98e0, #006494)",
            }}
          >
            Към приложението ➡️
          </button>
        </div>
      )}
    </div>
  );
}
