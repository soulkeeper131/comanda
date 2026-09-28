"use client";

import { useState } from "react";
import Link from "next/link";
import AuthShell, { authInput } from "@/components/AuthShell";
import { Button } from "@/components/ui/Button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) setSent(true);
    else setError(res?.status === 429 ? "Твърде много опити. Изчакайте минута." : "Няма връзка. Опитайте отново.");
  };

  return (
    <AuthShell title="Забравена парола">
      {sent ? (
        <p className="text-ink">
          Ако има профил с <strong>{email}</strong>, изпратихме линк за нова парола. Проверете пощата (и папка „Спам“).
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm text-muted">Въведете имейла си и ще ви изпратим линк за нова парола.</p>
          <input className={authInput} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Имейл" />
          {error && <p className="text-sm text-state-danger">{error}</p>}
          <Button type="submit" fullWidth disabled={busy || !email}>
            {busy ? "Изпращане…" : "Изпрати линк"}
          </Button>
        </form>
      )}
      <Link href="/login" className="mt-4 block text-center text-sm font-semibold text-brand-primary">
        Обратно към входа
      </Link>
    </AuthShell>
  );
}
