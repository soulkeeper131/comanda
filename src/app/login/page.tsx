"use client";

import { useState } from "react";
import Link from "next/link";
import AuthShell, { authInput } from "@/components/AuthShell";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [resent, setResent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNeedsVerify(false);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        window.location.href = "/dashboard";
        return;
      }
      if (data.verify_required) setNeedsVerify(true);
      setError(res.status === 429 ? "Твърде много опити. Изчакайте минута." : data.error || "Грешка при вход");
    } catch {
      setError("Няма връзка. Опитайте отново.");
    }
    setLoading(false);
  };

  const resend = async () => {
    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    setResent(true);
  };

  return (
    <AuthShell title="Вход">
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <p className="rounded-card bg-state-danger/10 px-3 py-2 text-sm text-state-danger">{error}</p>}
        {needsVerify && (
          <div className="rounded-card bg-brand-bg px-3 py-2 text-sm text-ink-2">
            {resent ? (
              "Изпратихме нов линк. Проверете пощата (и папка „Спам“)."
            ) : (
              <button type="button" onClick={resend} className="font-semibold text-brand-primary">
                Изпрати ми линка отново
              </button>
            )}
          </div>
        )}
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink-2">Имейл</span>
          <input className={authInput} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ime@primer.bg" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink-2">Парола</span>
          <input className={authInput} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <Button type="submit" fullWidth size="lg" disabled={loading}>
          {loading ? "Вход…" : "Вход"}
        </Button>
      </form>
      <div className="mt-4 flex flex-col items-center gap-2 text-sm">
        <Link href="/forgot-password" className="font-semibold text-brand-primary">
          Забравена парола
        </Link>
        <Link href="/register" className="font-semibold text-brand-accent">
          Нямате профил? Регистрация
        </Link>
      </div>
    </AuthShell>
  );
}
