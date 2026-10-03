"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { isValidEmail } from "@/lib/domain/email";

const PLAN_NAMES: Record<string, string> = { year: "Пълен надзор", winter: "Зимен сезон", summer: "Летен сезон" };

function RegisterForm() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") || "";
  // Пакетът от началната страница се помни до избора след одобрението на
  // имота (цената идва от каталога тогава, не се показва тук твърдо).
  // Старите връзки (year/winter/summer) и новите — с името на пакета от каталога.
  const planName = PLAN_NAMES[plan] ?? (plan.length <= 80 ? plan : "");
  useEffect(() => {
    if (!planName) return;
    try {
      localStorage.setItem("komanda_preferred_plan", planName);
    } catch {
      /* private mode */
    }
  }, [planName]);
  const [accountType, setAccountType] = useState<"individual" | "company">("individual");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [eik, setEik] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [verifySentTo, setVerifySentTo] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!name.trim()) return "Името е задължително";
    if (!isValidEmail(email.trim().toLowerCase())) return "Невалиден имейл адрес";
    if (password.length < 8) return "Паролата трябва да е поне 8 символа";
    if (password !== confirmPassword) return "Паролите не съвпадат";
    if (!acceptTerms) return "Необходимо е съгласие с Общите условия и Политиката за поверителност";
    if (accountType === "company") {
      if (!companyName.trim()) return "Името на фирмата е задължително";
      if (!eik.trim()) return "ЕИК е задължително";
      if (!billingAddress.trim()) return "Адресът на регистрация е задължителен за фактурите";
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
          billing_address: accountType === "company" ? billingAddress.trim() : undefined,
          accept_terms: acceptTerms,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Грешка при регистрация");
      } else if (data.verify_required) {
        setVerifySentTo(data.email || email);
      } else {
        // Стъпка 2 — имотът. Без него няма какво да се одобри и избере.
        window.location.href = "/register/property";
      }
    } catch {
      setError("Възникна грешка. Опитай отново.");
    } finally {
      setLoading(false);
    }
  };

  if (verifySentTo) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6" style={{ backgroundColor: "#e8f1f2" }}>
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <h1 className="mb-3 text-xl font-bold" style={{ color: "#006494" }}>Проверете пощата си</h1>
          <p className="text-sm" style={{ color: "#334155" }}>
            Изпратихме линк за потвърждение на <strong>{verifySentTo}</strong>. Отворете го, за да продължите с
            добавянето на имота. Ако не го виждате — проверете папка „Спам“.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6" style={{ backgroundColor: "#e8f1f2" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <img
            src="/logo.png"
            alt="КОМАНДА"
            className="h-14 mx-auto mb-4"
          />
          {planName && (
            <div className="inline-block px-4 py-2 rounded-full text-sm font-semibold mb-3" style={{ background: "#e0f2fe", color: "#1b98e0" }}>
              Избран пакет: {planName}
            </div>
          )}
          <p className="text-sm mt-2" style={{ color: "#247ba0" }}>
            Стъпка 1 от 3 — Създай своя профил
          </p>
          <p className="text-xs mt-1" style={{ color: "#64748b" }}>
            След това: имотът → одобрение и избор на пакет
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
                Физическо лице
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
                Фирма
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
                <label className="block text-sm font-semibold mb-2" style={{ color: "#006494" }}>Адрес на регистрация</label>
                <input
                  type="text"
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  placeholder="гр. София, ул. Пример 1"
                  required
                  autoComplete="street-address"
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

          <label className="mb-5 flex items-start gap-3 text-sm" style={{ color: "#334155" }}>
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 h-5 w-5 flex-shrink-0"
            />
            <span>
              Съгласен съм с{" "}
              <a href="/terms" target="_blank" className="font-semibold underline" style={{ color: "#1b98e0" }}>
                Общите условия
              </a>{" "}
              и{" "}
              <a href="/privacy" target="_blank" className="font-semibold underline" style={{ color: "#1b98e0" }}>
                Политиката за поверителност
              </a>
            </span>
          </label>

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
            <Link href="/" className="font-semibold hover:underline" style={{ color: "#1b98e0" }}>
              началната страница
            </Link>
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
