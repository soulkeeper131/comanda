"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AuthShell from "@/components/AuthShell";
import { Button } from "@/components/ui/Button";

function Verify() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"working" | "ok" | "error">("working");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setError("Липсва линк за потвърждение.");
      return;
    }
    fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const d = await res.json().catch(() => ({}));
        if (res.ok) {
          setState("ok");
          setTimeout(() => (window.location.href = d.next || "/dashboard"), 1200);
        } else {
          setState("error");
          setError(d.error || "Линкът не е валиден.");
        }
      })
      .catch(() => {
        setState("error");
        setError("Няма връзка. Опитайте отново.");
      });
  }, [token]);

  return (
    <AuthShell title="Потвърждение на имейла">
      {state === "working" && <p className="text-muted">Проверяваме линка…</p>}
      {state === "ok" && <p className="text-state-ok">Имейлът е потвърден. Пренасочваме ви…</p>}
      {state === "error" && (
        <div className="space-y-3">
          <p className="text-state-danger">{error}</p>
          <Button fullWidth onClick={() => (window.location.href = "/login")}>
            Към входа — там можете да поискате нов линк
          </Button>
        </div>
      )}
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  );
}
