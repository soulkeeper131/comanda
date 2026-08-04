"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") || "";
  const [accountType, setAccountType] = useState<"individual" | "company">("individual");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [eik, setEik] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const validate = (): string | null => {
    if (!name.trim()) return "Името е задължително";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Невалиден имейл адрес";
    if (password.length < 6) return "Паролата трябва да е поне 6 символа";
    if (password !== confirmPassword) return "Паролите не съвпадат";
    if (accountType === "company") {
      if (!companyName.trim()) return "Името на фирмата е задължително";
      if (!eik.trim()) return "ЕИК е задължително";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: name.trim(),
          phone: phone.trim() || undefined,
          is_company: accountType === "company",
          company_name: accountType === "company" ? companyName.trim() : undefined,
          eik: accountType === "company" ? eik.trim() : undefined,
          vat_number: accountType === "company" ? vatNumber.trim() || undefined : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Грешка при регистрация");
      } else {
        const target = plan ? `/register/property?plan=${encodeURIComponent(plan)}` : "/dashboard";
        window.location.href = target;
      }
    } catch {
      setError("Възникна грешка. Опитай отново.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6" style={{ backgroundColor: "#e8f1f2" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <img
            src="/logo.png"
            alt="КОМАНДА"
            className="h-14 mx-auto mb-4"
          />
          {plan && (
            <div className="inline-block px-4 py-2 rounded-full text-sm font-semibold mb-3" style={{ background: "#e0f2fe", color: "#1b98e0" }}>
              {plan === "year" ? "🔄 Пълен надзор · 60€/мес" : plan === "winter" ? "❄️ Зимен сезон · 40€/мес" : "☀️ Летен сезон · 50€/мес"}
            </div>
          )}
          <p className="text-sm mt-2" style={{ color: "#247ba0" }}>
            Стъпка 1 от 3 — Създай своя профил
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm font-medium">
              {error}
            </div>
          )}

          {/* Тип профил */}
          <div className="mb-5">
            <label className="block text-sm font-semibold mb-2" style={{ color: "#006494" }}>Тип профил</label>
            <div className="flex gap-3">
              <label
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border cursor-pointer transition text-sm font-semibold ${
                  accountType === "individual"
                    ? "border-[#1b98e0] bg-blue-50 text-[#1b98e0]"
                    : "border-gray-200 text-[#247ba0]"
                }`}
                style={{ minHeight: "44px" }}
              >
                <input
                  type="radio"
                  name="accountType"
                  value="individual"
                  checked={accountType === "individual"}
                  onChange={() => setAccountType("individual")}
                  className="sr-only"
                />
                👤 Физическо лице
              </label>
              <label
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border cursor-pointer transition text-sm font-semibold ${
                  accountType === "company"
                    ? "border-[#1b98e0] bg-blue-50 text-[#1b98e0]"
                    : "border-gray-200 text-[#247ba0]"
                }`}
                style={{ minHeight: "44px" }}
              >
                <input
                  type="radio"
                  name="accountType"
                  value="company"
                  checked={accountType === "company"}
                  onChange={() => setAccountType("company")}
                  className="sr-only"
                />
                🏢 Фирма
              </label>
            </div>
          </div>

          {/* Име */}
          <div className="mb-5">
            <label className="block text-sm font-semibold mb-2" style={{ color: "#006494" }}>Име</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Иван Иванов"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 transition"
              style={{ fontSize: "16px", minHeight: "44px" }}
            />
          </div>

          {/* Фирмени полета */}
          {accountType === "company" && (
            <>
              <div className="mb-5">
                <label className="block text-sm font-semibold mb-2" style={{ color: "#006494" }}>Име на фирма</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Фирма ЕООД"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 transition"
                  style={{ fontSize: "16px", minHeight: "44px" }}
                />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-semibold mb-2" style={{ color: "#006494" }}>ЕИК</label>
                <input
                  type="text"
                  value={eik}
                  onChange={(e) => setEik(e.target.value)}
                  placeholder="123456789"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 transition"
                  style={{ fontSize: "16px", minHeight: "44px" }}
                />
              </div>
              <div className="mb-5">
                <label className="block text-sm font-semibold mb-2" style={{ color: "#006494" }}>ДДС номер <span className="font-normal text-gray-400">(по желание)</span></label>
                <input
                  type="text"
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  placeholder="BG123456789"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 transition"
                  style={{ fontSize: "16px", minHeight: "44px" }}
                />
              </div>
            </>
          )}

          {/* Телефон */}
          <div className="mb-5">
            <label className="block text-sm font-semibold mb-2" style={{ color: "#006494" }}>Телефон <span className="font-normal text-gray-400">(по желание)</span></label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+359 88 123 4567"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 transition"
              style={{ fontSize: "16px", minHeight: "44px" }}
            />
          </div>

          {/* Имейл */}
          <div className="mb-5">
            <label className="block text-sm font-semibold mb-2" style={{ color: "#006494" }}>Имейл</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ivan@example.com"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 transition"
              style={{ fontSize: "16px", minHeight: "44px" }}
            />
          </div>

          {/* Парола */}
          <div className="mb-5">
            <label className="block text-sm font-semibold mb-2" style={{ color: "#006494" }}>Парола</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 transition"
              style={{ fontSize: "16px", minHeight: "44px" }}
            />
          </div>

          {/* Потвърди парола */}
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2" style={{ color: "#006494" }}>Потвърди паролата</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 transition"
              style={{ fontSize: "16px", minHeight: "44px" }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl text-white font-semibold text-base transition-all disabled:opacity-60"
            style={{
              background: "linear-gradient(140deg, #1b98e0, #006494)",
              boxShadow: "0 4px 14px rgba(0,100,148,0.25)",
              minHeight: "44px",
            }}
          >
            {loading ? "Регистрация..." : "Регистрация"}
          </button>

          <p className="text-center text-sm mt-6" style={{ color: "#247ba0" }}>
            ← Обратно към{" "}
            <a href="/" className="font-semibold hover:underline" style={{ color: "#1b98e0" }}>
              началната страница
            </a>
          </p>
        </form>

        <p className="text-center text-sm mt-5" style={{ color: "#247ba0" }}>
          Вече имаш профил?{" "}
          <a href="/login" className="font-semibold hover:underline" style={{ color: "#1b98e0" }}>
            Влез оттук
          </a>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] flex items-center justify-center" style={{ backgroundColor: "#e8f1f2" }}><p>Зареждане...</p></div>}>
      <RegisterForm />
    </Suspense>
  );
}
