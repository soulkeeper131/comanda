"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthShell, { authInput } from "@/components/AuthShell";
import { Button } from "@/components/ui/Button";

function Reset() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError("Паролата трябва да е поне 8 символа");
    if (password !== confirm) return setError("Паролите не съвпадат");
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    }).catch(() => null);
    const d = await res?.json().catch(() => ({}));
    if (res?.ok) window.location.href = "/dashboard";
    else {
      setBusy(false);
      setError(d?.error || "Няма връзка. Опитайте отново.");
    }
  };

  return (
    <AuthShell title="Нова парола">
      <form onSubmit={submit} className="space-y-3">
        <input className={authInput} type="password" autoComplete="new-password" placeholder="Нова парола (поне 8 символа)" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input className={authInput} type="password" autoComplete="new-password" placeholder="Повторете паролата" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {error && <p className="text-sm text-state-danger">{error}</p>}
        <Button type="submit" fullWidth disabled={busy || !token}>
          {busy ? "Запазване…" : "Запази и влез"}
        </Button>
      </form>
      <Link href="/forgot-password" className="mt-4 block text-center text-sm font-semibold text-brand-primary">
        Поискай нов линк
      </Link>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <Reset />
    </Suspense>
  );
}
