"use client";

import { useEffect, useState } from "react";
import Topbar from "@/components/Topbar";
import ClientHome from "@/features/client/ClientHome";
import { Suspense } from "react";
import InspectorHome from "@/features/inspector/InspectorHome";
import AdminHome from "@/features/admin/AdminHome";

type Role = "admin" | "client" | "inspector";

/**
 * Рутер по роля (N12). Всяка роля има свой екран в src/features/:
 *   клиент    → „Моят имот" (доказателството от обходите)
 *   инспектор → седмичният график и чеклистът на терен
 *   админ     → работните опашки и управлението
 */
export default function DashboardPage() {
  const [role, setRole] = useState<Role | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => {
        if (res.status === 401) {
          window.location.href = "/login";
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((data) => {
        if (data?.role) setRole(data.role as Role);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, []);

  if (!role) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-3 bg-brand-bg px-6 text-center">
        {failed ? (
          <>
            <p className="text-ink">Не успяхме да заредим профила ви.</p>
            <button className="min-h-touch font-semibold text-brand-primary" onClick={() => window.location.reload()}>
              Опитайте отново
            </button>
          </>
        ) : (
          <p className="text-muted">Зареждане…</p>
        )}
      </div>
    );
  }

  const narrow = role !== "admin";
  return (
    <div
      className={`flex h-[100dvh] flex-col bg-brand-bg ${
        narrow ? "md:mx-auto md:max-w-3xl md:border-x md:border-line md:shadow-card-3" : ""
      }`}
    >
      <Topbar />
      {role === "client" && (
        <Suspense fallback={null}>
          <ClientHome />
        </Suspense>
      )}
      {role === "inspector" && <InspectorHome />}
      {role === "admin" && <AdminHome />}
    </div>
  );
}
