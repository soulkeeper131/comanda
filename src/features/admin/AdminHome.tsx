"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { DEFAULT_PREPAY_THRESHOLD } from "@/lib/domain/offers";
import { api } from "./api";
import AdminQueues from "./AdminQueues";
import JobsSection from "./JobsSection";
import PropertiesSection from "./PropertiesSection";
import IssuesSection from "./IssuesSection";
import PlansSection from "./PlansSection";
import SettingsSection from "./SettingsSection";
import { Loading, useToast } from "./ui";
import { useAdminData } from "./useAdminData";

type Section = "today" | "jobs" | "properties" | "issues" | "plans" | "settings";

const NAV: { id: Section; label: string; icon: IconName }[] = [
  { id: "today", label: "Табло", icon: "inbox" },
  { id: "jobs", label: "Обходи", icon: "calendar" },
  { id: "properties", label: "Имоти", icon: "home" },
  { id: "issues", label: "Проблеми", icon: "alert" },
  { id: "plans", label: "Пари", icon: "package" },
  { id: "settings", label: "Настройки", icon: "settings" },
];

const STORAGE_KEY = "komanda_admin_section";

/**
 * Админският панел (N12) — заменя таб-монолита в dashboard/page.tsx.
 * Началото е „Табло": работните опашки, не статистики.
 */
export default function AdminHome() {
  const { data, loading, error, reload } = useAdminData();
  const toast = useToast();
  const [section, setSection] = useState<Section>("today");
  const [focusProperty, setFocusProperty] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(DEFAULT_PREPAY_THRESHOLD);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Section | null;
      if (saved && NAV.some((n) => n.id === saved)) setSection(saved);
    } catch {
      /* private mode — остава таблото */
    }
    api<{ prepay_threshold: number }>("/api/admin/settings").then((r) => {
      if (r.ok) setThreshold(r.data.prepay_threshold);
    });
  }, []);

  const go = useCallback((s: Section) => {
    setSection(s);
    try {
      localStorage.setItem(STORAGE_KEY, s);
    } catch {
      /* без запомняне */
    }
  }, []);

  const badges: Partial<Record<Section, number>> = {
    today:
      data.properties.filter((p) => p.approval_status === "pending").length +
      data.plans.filter((p) => p.status === "requested").length +
      data.findings.filter((f) => f.status === "quote_requested" || (f.severity === "urgent" && f.status === "open")).length +
      data.payments.filter((p) => p.status === "refund_needed" || (p.status === "pending" && p.method !== "card")).length +
      data.inquiries.filter((i) => i.status === "new").length,
  };

  const onFocused = useCallback(() => setFocusProperty(null), []);

  const content = (() => {
    if (loading) return <Loading />;
    const common = { data, reload, toast: toast.show };
    switch (section) {
      case "today":
        return (
          <AdminQueues
            {...common}
            threshold={threshold}
            openProperty={(id) => {
              setFocusProperty(id);
              go("properties");
            }}
            goTo={go}
          />
        );
      case "jobs":
        return <JobsSection {...common} />;
      case "properties":
        return <PropertiesSection {...common} focusId={focusProperty} onFocused={onFocused} />;
      case "issues":
        return <IssuesSection {...common} threshold={threshold} />;
      case "plans":
        return <PlansSection {...common} />;
      case "settings":
        return <SettingsSection {...common} onThresholdChange={setThreshold} />;
    }
  })();

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="hidden w-56 flex-shrink-0 flex-col border-r border-line bg-white/60 md:flex">
        <nav className="flex-1 space-y-0.5 p-3">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              className={`flex w-full min-h-touch items-center gap-2.5 rounded-card px-3 text-left text-sm font-semibold transition ${
                section === n.id ? "bg-brand-primary/10 text-brand-primary" : "text-ink-2 hover:bg-brand-bg"
              }`}
            >
              <Icon name={n.icon} size={18} />
              <span className="flex-1">{n.label}</span>
              {!!badges[n.id] && (
                <span className="rounded-full bg-brand-primary px-1.5 text-xs text-white">{badges[n.id]}</span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 overflow-y-auto px-4 pb-28 pt-4 md:pb-8">
          {error && (
            <p className="mb-3 rounded-card bg-state-danger/10 px-3 py-2 text-sm text-state-danger">{error}</p>
          )}
          <div className="mx-auto max-w-4xl">{content}</div>
        </main>

        {/* Долна навигация на телефон — палецът стига до нея. */}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-line bg-white/95 backdrop-blur md:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              className={`relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
                section === n.id ? "text-brand-primary" : "text-muted"
              }`}
            >
              <Icon name={n.icon} size={20} />
              {n.label}
              {!!badges[n.id] && (
                <span className="absolute right-[18%] top-1.5 h-2 w-2 rounded-full bg-state-danger" aria-hidden />
              )}
            </button>
          ))}
        </nav>
      </div>
      {toast.node}
    </div>
  );
}
