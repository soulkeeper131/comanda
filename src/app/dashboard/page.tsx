"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Topbar from "@/components/Topbar";
import MapView from "@/components/MapView";
import PropertySheet from "@/components/PropertySheet";
import PropertyForm from "@/components/PropertyForm";
import ChecklistSheet from "@/components/ChecklistSheet";
import FindingsSheet from "@/components/FindingsSheet";
import OffersPanel from "@/components/OffersPanel";
import HistoryList from "@/components/HistoryList";
import TaskForm from "@/components/TaskForm";
import TemplateManager from "@/components/TemplateManager";
import SmtpSettings from "@/components/SmtpSettings";
import ClientProfile from "@/components/ClientProfile";
import PlanSelector from "@/components/PlanSelector";
import OnboardingPage from "./onboarding/page";

type UserRole = "admin" | "client" | "inspector";

type TabDef = { id: string; label: string; roles: UserRole[] };

const ALL_TABS: TabDef[] = [
  { id: "overview", label: "📊 Преглед", roles: ["admin", "client", "inspector"] },
  { id: "map", label: "🗺️ Карта", roles: ["admin", "client", "inspector"] },
  { id: "tours", label: "📋 Обходи", roles: ["admin", "inspector", "client"] },
  { id: "issues", label: "⚠️ Проблеми", roles: ["admin", "client"] },
  { id: "props", label: "🏠 Имоти", roles: ["admin", "inspector", "client"] },
  { id: "profile", label: "👤 Профил", roles: ["client"] },
  { id: "settings", label: "⚙️ Настройки", roles: ["admin"] },
];

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  admin: { label: "Админ", color: "#a663cc" },
  client: { label: "Клиент", color: "#1b98e0" },
  inspector: { label: "Инспектор", color: "#d97706" },
};

export default function DashboardPage() {
  const [tab, setTab] = useState("overview");
  const [subTab, setSubTab] = useState("calendar"); // sub-tab for tours/issues/settings

  // Onboarding check
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const done = localStorage.getItem("onboarding_done");
      if (!done) {
        setShowOnboarding(true);
      }
    }
    setOnboardingChecked(true);
  }, []);

  // Stats overview
  const [stats, setStats] = useState({ activeJobs: 0, plannedJobs: 0, completedJobs: 0, openFindings: 0, pendingOffers: 0, totalProperties: 0 });
  const [statsLoading, setStatsLoading] = useState(false);

  // Calendar filter
  const [calendarFilter, setCalendarFilter] = useState<string>("all");

  // Close all sheets/modals when switching tabs
  const switchTab = (id: string) => {
    setSelectedProperty(null);
    setShowAddForm(false);
    setActiveChecklist(null);
    setShowFindings(false);
    setSelectedFinding(null);
    setOfferFindingId(null);
    setEditingUserId(null);
    setBulkSelected(new Set());
    setShowBulkForm(false);
    setShowPayment(false);
    setReportProblemContext(null);
    setTab(id);
    // Reset sub-tab based on main tab
    if (id === "tours") setSubTab("calendar");
    else if (id === "issues") setSubTab("findings");
    else if (id === "settings") setSubTab("team");
  };
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPropertyId, setNewPropertyId] = useState<string | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeChecklist, setActiveChecklist] = useState<{ name: string; addr: string } | null>(null);
  const [showFindings, setShowFindings] = useState(false);
  const [findings, setFindings] = useState<any[]>([]);
  const [findingsLoading, setFindingsLoading] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole>("admin");
  const [userName, setUserName] = useState("");
  const [roleLoading, setRoleLoading] = useState(true);

  // Offer inline creation state
  const [offerFindingId, setOfferFindingId] = useState<string | null>(null);
  const [offerPrice, setOfferPrice] = useState("");
  const [offerDays, setOfferDays] = useState("");
  const [offerScope, setOfferScope] = useState("");

  // Payment state
  const [showPayment, setShowPayment] = useState(false);
  const [paymentOfferId, setPaymentOfferId] = useState("");
  const [paymentPrice, setPaymentPrice] = useState(0);
  const [paymentTitle, setPaymentTitle] = useState("");

  // Report problem from checklist context
  const [reportProblemContext, setReportProblemContext] = useState<{
    jobItemId: string;
    itemLabel: string;
    zone: string;
    propertyId?: string;
    jobId?: string;
  } | null>(null);

  // Календар state
  const [calendarJobs, setCalendarJobs] = useState<any[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Екип state
  const [teamUsers, setTeamUsers] = useState<any[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);

  // Templates for tasks tab
  const [taskTemplates, setTaskTemplates] = useState<any[]>([]);
  const [taskTemplatesLoading, setTaskTemplatesLoading] = useState(false);

  // Inline edit state for Team tab
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("client");

  // Filter states for sub-tabs
  const [findingsStatusFilter, setFindingsStatusFilter] = useState("all");
  const [fixesDecisionFilter, setFixesDecisionFilter] = useState("all");

  // Bulk assign state
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [bulkTemplateId, setBulkTemplateId] = useState("");
  const [bulkAssigneeId, setBulkAssigneeId] = useState("");
  const [bulkPlannedAt, setBulkPlannedAt] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkUsers, setBulkUsers] = useState<any[]>([]);

  // Fetch user role
  useEffect(() => {
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.role) setUserRole(data.role as UserRole);
        if (data?.name) setUserName(data.name);
        setRoleLoading(false);
      })
      .catch(() => setRoleLoading(false));
  }, []);

  // Fetch stats for overview tab
  useEffect(() => {
    if (tab !== "overview") return;
    setStatsLoading(true);
    fetch("/api/stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setStats(data);
        setStatsLoading(false);
      })
      .catch(() => setStatsLoading(false));
  }, [tab]);

  // Allowed tabs for current role
  const TABS = useMemo(
    () => ALL_TABS.filter((t) => t.roles.includes(userRole)),
    [userRole]
  );

  // On role change, set tab to first available if current is not allowed
  useEffect(() => {
    if (roleLoading) return;
    const allowed = TABS.find((t) => t.id === tab);
    if (!allowed && TABS.length > 0) {
      switchTab(TABS[0].id);
    }
  }, [roleLoading, TABS, tab]);

  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(""), 2600);
  };

  const loadProperties = useCallback(async () => {
    try {
      const res = await fetch("/api/properties");
      if (res.ok) {
        const data = await res.json();
        setProperties(
          data.map((p: any) => ({
            id: p.id,
            name: p.name,
            addr: p.address,
            lat: p.lat,
            lng: p.lng,
            kind: p.kind || "apartment",
            status: (p.status || "ok") as string,
            zones: ["Антре", "Дневна", "Баня", "Кухня"],
            access: p.access_notes || "",
            lastVisit: p.updated_at || new Date().toISOString(),
            plan: "Пълен надзор",
          }))
        );
      }
    } catch (e) {
      console.error("Load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFindings = useCallback(async () => {
    setFindingsLoading(true);
    try {
      const params = new URLSearchParams();
      if (findingsStatusFilter !== "all") params.set("status", findingsStatusFilter);
      const qs = params.toString();
      const res = await fetch("/api/findings" + (qs ? "?" + qs : ""));
      if (res.ok) {
        const data = await res.json();
        setFindings(data);
      }
    } catch (e) {
      console.error("Findings load error:", e);
    } finally {
      setFindingsLoading(false);
    }
  }, [findingsStatusFilter]);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  useEffect(() => {
    if (tab === "issues" && subTab === "findings" || tab === "issues" && subTab === "fixes") {
      loadFindings();
    }
  }, [tab, loadFindings]);

  // Fetch calendar jobs
  useEffect(() => {
    if (!(tab === "tours" && subTab === "calendar")) return;
    setCalendarLoading(true);
    const params = new URLSearchParams();
    if (calendarFilter !== "all") params.set("status", calendarFilter);
    const qs = params.toString();
    fetch("/api/jobs" + (qs ? "?" + qs : ""))
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setCalendarJobs(Array.isArray(data) ? data : []))
      .catch(() => setCalendarJobs([]))
      .finally(() => setCalendarLoading(false));
  }, [tab, calendarFilter]);

  // Fetch team users
  useEffect(() => {
    if (!(tab === "settings" && subTab === "team")) return;
    setTeamLoading(true);
    fetch("/api/users")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setTeamUsers((data.users || (Array.isArray(data) ? data : []))))
      .catch(() => setTeamUsers([]))
      .finally(() => setTeamLoading(false));
  }, [tab]);

  // Fetch task templates
  useEffect(() => {
    if (!(tab === "tours" && subTab === "tasks")) return;
    setTaskTemplatesLoading(true);
    fetch("/api/templates")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setTaskTemplates(Array.isArray(data) ? data : []))
      .catch(() => setTaskTemplates([]))
      .finally(() => setTaskTemplatesLoading(false));
  }, [tab]);

  // Polling: refresh jobs & properties every 30s on active tabs
  useEffect(() => {
    const pollTabs = ["map", "calendar", "props", "history"];
    if (!pollTabs.includes(tab)) return;
    const interval = setInterval(() => {
      loadProperties();
      if (tab === "tours" && subTab === "calendar") {
        fetch("/api/jobs")
          .then((r) => r.ok ? r.json() : [])
          .then((d) => setCalendarJobs(Array.isArray(d) ? d : []))
          .catch(() => {});
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [tab, loadProperties]);

  const handleEditStart = (user: any) => {
    setEditingUserId(user.id);
    setEditName(user.name || "");
    setEditRole((user.role as UserRole) || "client");
  };

  const handleEditCancel = () => {
    setEditingUserId(null);
    setEditName("");
    setEditRole("client");
  };

  const handleEditSave = async (userId: string) => {
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, full_name: editName.trim(), role: editRole }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTeamUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
        showToast("✅ Потребителят е обновен");
      } else {
        showToast("❌ Грешка при обновяване");
      }
    } catch {
      showToast("❌ Грешка при обновяване");
    }
    handleEditCancel();
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Сигурни ли сте, че искате да деактивирате този потребител?")) return;
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, active: false }),
      });
      if (res.ok) {
        setTeamUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, active: false } : u)));
        showToast("✅ Потребителят е деактивиран");
      } else {
        showToast("❌ Грешка при деактивиране");
      }
    } catch {
      showToast("❌ Грешка при деактивиране");
    }
  };

  const filtered = properties.filter(
    (p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.addr || "").toLowerCase().includes(search.toLowerCase())
  );

  const statusDot = (s: string) => {
    const colors: Record<string, string> = { ok: "#16a34a", soon: "#d97706", overdue: "#dc2626" };
    return <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colors[s] || "#999" }} />;
  };

  const handleReportProblem = () => {
    setReportProblemContext(null);
    setShowFindings(true);
  };

  const handleChecklistReportProblem = (data: { jobItemId: string; itemLabel: string; zone: string }) => {
    // Open findings sheet with context from the checklist — WITHOUT closing the checklist
    setReportProblemContext({
      jobItemId: data.jobItemId,
      itemLabel: data.itemLabel,
      zone: data.zone,
      propertyId: activeChecklist ? undefined : undefined,
      jobId: undefined,
    });
    setShowFindings(true);
  };

  const handleTaskSave = async (data: { propertyId: string; templateId: string; assigneeId: string; title: string; plannedAt: string }) => {
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: data.propertyId,
          template_id: data.templateId,
          assignee_id: data.assigneeId || undefined,
          title: data.title,
          planned_at: data.plannedAt,
        }),
      });
      if (res.ok) {
        showToast("✅ Задачата е възложена");
        setTab("tours"); setSubTab("calendar");
      } else {
        const err = await res.json().catch(() => ({}));
        showToast("❌ " + (err.error || "Грешка"));
      }
    } catch {
      showToast("❌ Грешка при възлагане");
    }
  };

  const handleSaveFinding = async (data: { type: string; title: string; body: string; propertyId?: string; jobId?: string; jobItemId?: string }) => {
    try {
      const payload: Record<string, unknown> = {
        type: data.type,
        title: data.title,
        body: data.body,
        property_id: data.propertyId || (reportProblemContext ? undefined : "p1"),
      };
      if (data.jobId || reportProblemContext?.jobId) payload.job_id = data.jobId || reportProblemContext?.jobId;
      if (data.jobItemId || reportProblemContext?.jobItemId) payload.job_item_id = data.jobItemId || reportProblemContext?.jobItemId;

      const res = await fetch("/api/findings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showToast("✅ Проблемът е докладван");
        setShowFindings(false);
        setReportProblemContext(null);
        loadFindings();
      } else {
        showToast("❌ Грешка при докладване");
      }
    } catch {
      showToast("❌ Грешка при докладване");
    }
  };

  const handleAcceptOffer = async (offerId: string) => {
    try {
      const res = await fetch(`/api/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "accepted" }),
      });
      if (res.ok) {
        showToast("✅ Офертата е приета");
        loadFindings();
      } else {
        showToast("❌ Грешка при приемане");
      }
    } catch {
      showToast("❌ Грешка при приемане");
    }
    setSelectedFinding(null);
  };

  const handleDeclineOffer = async (offerId: string) => {
    try {
      const res = await fetch(`/api/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "declined" }),
      });
      if (res.ok) {
        showToast("❌ Офертата е отказана");
        loadFindings();
      } else {
        showToast("❌ Грешка при отказване");
      }
    } catch {
      showToast("❌ Грешка при отказване");
    }
    setSelectedFinding(null);
  };

  const handleOpenPayment = (offerId: string) => {
    // Find the offer to get price and title
    fetch(`/api/offers?finding_id=&decision=accepted`)
      .then((r) => (r.ok ? r.json() : []))
      .then((offers: any[]) => {
        const offer = offers.find((o: any) => o.id === offerId);
        if (offer) {
          setPaymentOfferId(offerId);
          setPaymentPrice(offer.price || 0);
          setPaymentTitle(offer.finding?.title || "Оферта");
          setShowPayment(true);
        }
      })
      .catch(() => {
        showToast("❌ Грешка при зареждане на оферта");
      });
  };

  const handlePaymentComplete = () => {
    showToast("✅ Плащането е успешно!");
    setShowPayment(false);
    loadFindings();
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm("Сигурни ли сте, че искате да изтриете тази задача?")) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
      if (res.ok) {
        showToast("✅ Задачата е изтрита");
        // Refresh calendar jobs
        fetch("/api/jobs")
          .then((r) => (r.ok ? r.json() : []))
          .then((d) => setCalendarJobs(Array.isArray(d) ? d : []))
          .catch(() => {});
      } else {
        const err = await res.json().catch(() => ({}));
        showToast("❌ " + (err.error || "Грешка при изтриване"));
      }
    } catch {
      showToast("❌ Грешка при изтриване");
    }
  };

  const handleBulkAssign = async () => {
    if (bulkSelected.size === 0) {
      showToast("❌ Избери поне един имот");
      return;
    }
    if (!bulkTemplateId) {
      showToast("❌ Избери шаблон");
      return;
    }
    if (!bulkPlannedAt) {
      showToast("❌ Посочи планирана дата");
      return;
    }
    setBulkSubmitting(true);
    try {
      const res = await fetch("/api/jobs/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_ids: Array.from(bulkSelected),
          template_id: bulkTemplateId,
          assignee_id: bulkAssigneeId || undefined,
          planned_at: new Date(bulkPlannedAt).toISOString(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        showToast(`✅ Създадени ${data.created} задачи`);
        setBulkSelected(new Set());
        setShowBulkForm(false);
        setBulkTemplateId("");
        setBulkAssigneeId("");
        setTab("tours"); setSubTab("calendar");
      } else {
        const err = await res.json().catch(() => ({}));
        showToast("❌ " + (err.error || "Грешка при възлагане"));
      }
    } catch {
      showToast("❌ Грешка при възлагане");
    }
    setBulkSubmitting(false);
  };

  const showFAB = userRole === "admin";

  if (roleLoading) {
    return (
      <div className="flex flex-col h-[100dvh] items-center justify-center" style={{ backgroundColor: "#e8f1f2" }}>
        <div className="text-lg" style={{ color: "#247ba0" }}>Зареждане...</div>
      </div>
    );
  }

  // Show onboarding if not done yet
  if (showOnboarding && !roleLoading && onboardingChecked) {
    return <OnboardingPage />;
  }

  return (
    <div className="flex flex-col h-[100dvh] md:max-w-7xl md:mx-auto md:shadow-xl md:border-x md:rounded-none" style={{ backgroundColor: "#e8f1f2", borderColor: "#e4e9f0" }}>
      <Topbar />

      <div className="flex flex-1 overflow-hidden">
        {/* ====== Desktop Sidebar (md+) ====== */}
        <aside className="hidden md:flex md:flex-col md:w-60 md:flex-shrink-0 md:border-r md:bg-white/50 md:backdrop-blur-sm" style={{ borderColor: "#e4e9f0" }}>
          {/* Brand header */}
          <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "#e4e9f0" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: "linear-gradient(140deg, #1b98e0, #006494)" }}>К</div>
            <span className="text-base font-bold" style={{ color: "#006494" }}>Ко Манда</span>
          </div>
          {/* Nav items */}
          <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold transition flex items-center gap-2.5"
                style={{
                  background: tab === t.id ? "#eff6ff" : "transparent",
                  color: tab === t.id ? "#1b98e0" : "#334155",
                }}
              >
                {t.label}
              </button>
            ))}
          </nav>
          {/* Bottom user info */}
          {(() => { const b = ROLE_BADGE[userRole]; const ini = userName ? userName.charAt(0) : "В"; return (
            <div className="px-4 py-3 border-t flex items-center gap-2" style={{ borderColor: "#e4e9f0" }}>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                style={{ background: `linear-gradient(140deg, ${b?.color || "#1b98e0"}, #006494)` }}
              >
                {ini}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate" style={{ color: "#006494" }}>{userName || "Потребител"}</div>
                {b && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: b.color + "18", color: b.color }}>{b.label}</span>}
              </div>
            </div>
          ); })()}
        </aside>

        {/* ====== Main content area ====== */}
        <div className="flex-1 flex flex-col overflow-hidden md:min-w-0">

      {/* Mobile tab bar (hidden on desktop) */}
      <div className="md:hidden flex gap-0 border-b flex-shrink-0 overflow-x-auto px-2"
        style={{ background: "rgba(255,255,255,0.7)", backdropFilter: "blur(14px)", borderColor: "#e4e9f0" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => switchTab(t.id)}
            className="px-4 min-h-[44px] py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition leading-[44px]"
            style={{ fontSize: 14, color: tab === t.id ? "#1b98e0" : "#247ba0", borderColor: tab === t.id ? "#1b98e0" : "transparent" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Sub-tabs for tours / issues / settings */}
      {(tab === "tours" || tab === "issues" || tab === "settings") && (
        <div className="flex gap-1 border-b flex-shrink-0 overflow-x-auto px-2 py-1"
          style={{ background: "rgba(255,255,255,0.6)", borderColor: "#e4e9f0" }}>
          {tab === "tours" && (
            <>
              {["calendar", "tasks", "history"].map(st => (
                <button key={st} onClick={() => setSubTab(st)}
                  className="px-3 min-h-[36px] py-1.5 text-xs font-semibold rounded-full transition"
                  style={{
                    fontSize: 13,
                    background: subTab === st ? "#1b98e0" : "transparent",
                    color: subTab === st ? "#fff" : "#247ba0",
                  }}>
                  {st === "calendar" ? "📅 Календар" : st === "tasks" ? "📋 Задачи" : "📊 История"}
                </button>
              ))}
            </>
          )}
          {tab === "issues" && (
            <>
              {["findings", "fixes"].map(st => (
                <button key={st} onClick={() => setSubTab(st)}
                  className="px-3 min-h-[36px] py-1.5 text-xs font-semibold rounded-full transition"
                  style={{
                    fontSize: 13,
                    background: subTab === st ? "#1b98e0" : "transparent",
                    color: subTab === st ? "#fff" : "#247ba0",
                  }}>
                  {st === "findings" ? "⚠️ Констатации" : "🔧 Ремонти"}
                </button>
              ))}
            </>
          )}
          {tab === "settings" && (
            <>
              {["team", "templates", "mailing"].map(st => (
                <button key={st} onClick={() => setSubTab(st)}
                  className="px-3 min-h-[36px] py-1.5 text-xs font-semibold rounded-full transition"
                  style={{
                    fontSize: 13,
                    background: subTab === st ? "#1b98e0" : "transparent",
                    color: subTab === st ? "#fff" : "#247ba0",
                  }}>
                  {st === "team" ? "👥 Екип" : st === "templates" ? "📋 Шаблони" : "📧 Мейлинг"}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#e8f1f2" }}>
            <div className="text-lg" style={{ color: "#247ba0" }}>Зареждане...</div>
          </div>
        )}

        {tab === "overview" && (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {statsLoading ? (
              <div className="text-center py-12" style={{ color: "#247ba0" }}>Зареждане...</div>
            ) : (
              <div className="space-y-3">
                <h2 className="text-lg font-bold mb-1" style={{ color: "#006494" }}>Общ преглед</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { key: "activeJobs", icon: "🔄", label: "Активни обходи", color: "#1b98e0", tab: "tours" },
                    { key: "plannedJobs", icon: "📅", label: "Планирани обходи", color: "#d97706", tab: "tours" },
                    { key: "completedJobs", icon: "✅", label: "Завършени обходи", color: "#16a34a", tab: "tours" },
                    { key: "openFindings", icon: "⚠️", label: "Отворени проблеми", color: "#dc2626", tab: "issues" },
                    { key: "pendingOffers", icon: "💰", label: "Чакащи оферти", color: "#a663cc", tab: "issues" },
                    { key: "totalProperties", icon: "🏠", label: "Активни имоти", color: "#0891b2", tab: "props" },
                  ].map((card) => (
                    <button
                      key={card.key}
                      onClick={() => {
                        setSelectedProperty(null);
                        setShowAddForm(false);
                        setActiveChecklist(null);
                        setShowFindings(false);
                        setSelectedFinding(null);
                        setOfferFindingId(null);
                        setEditingUserId(null);
                        setTab(card.tab);
                        if (card.tab === "issues") setSubTab("findings");
                        else if (card.tab === "tours") setSubTab("calendar");
                      }}
                      className="p-4 rounded-xl border bg-white text-left transition hover:shadow-md active:scale-[0.98]"
                      style={{ borderColor: "#e4e9f0" }}
                    >
                      <div className="text-3xl mb-2">{card.icon}</div>
                      <div className="text-3xl font-extrabold mb-1" style={{ color: card.color }}>
                        {(stats as any)[card.key] ?? 0}
                      </div>
                      <div className="text-xs font-semibold" style={{ color: "#247ba0" }}>
                        {card.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "map" && (
          <div className="flex-1 md:flex md:flex-row overflow-hidden">
            <div className="flex-1 md:w-[60%] h-full min-h-0">
              <MapView
                properties={properties.map((p: any) => ({
                  id: p.id,
                  name: p.name,
                  address: p.addr,
                  lat: p.lat,
                  lng: p.lng,
                  status: (p.status || "ok") as "ok" | "in_progress" | "warning" | "overdue",
                  kind: p.kind || "",
                  zones: p.zones || [],
                  accessNotes: p.access || "",
                  lastVisit: p.lastVisit || "",
                  plan: p.plan || "",
                }))}
                onPropertyClick={(p) => setSelectedProperty(p as any)}
              />
            </div>
            <div className="hidden md:flex md:flex-col md:w-[40%] md:border-l md:overflow-y-auto" style={{ borderColor: "#e4e9f0", backgroundColor: "#fff" }}>
              <div className="px-4 py-3 border-b flex-shrink-0" style={{ borderColor: "#e4e9f0" }}>
                <h3 className="text-sm font-bold" style={{ color: "#006494" }}>🏠 Имоти ({properties.length})</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {properties.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProperty(p)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition hover:bg-blue-50/50"
                    style={{ borderColor: "#e4e9f0", backgroundColor: selectedProperty?.id === p.id ? "#eff6ff" : "#fff" }}
                  >
                    {statusDot(p.status)}
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate" style={{ color: "#006494" }}>{p.name}</div>
                      <div className="text-[11px] truncate" style={{ color: "#247ba0" }}>{(p.addr || "").split(",")[0]}</div>
                    </div>
                    <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: "#247ba0" }}>
                      {p.zones?.length || 0} зони
                    </span>
                  </button>
                ))}
                {properties.length === 0 && !loading && (
                  <div className="text-center py-12" style={{ color: "#247ba0" }}>
                    <div className="text-3xl mb-2">🔍</div>
                    <div className="text-xs">Няма имоти</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "props" && (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <input type="text" placeholder="🔍 Търси обект..." value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border text-base mb-3"
              style={{ borderColor: "#e4e9f0", fontSize: 16, color: "#006494" }} />
            <div className="space-y-2">
              {filtered.map((p) => (
                <button key={p.id} onClick={() => setSelectedProperty(p)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border bg-white text-left transition hover:shadow-md"
                  style={{ borderColor: "#e4e9f0" }}>
                  {statusDot(p.status)}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate" style={{ color: "#006494" }}>{p.name}</div>
                    <div className="text-xs truncate" style={{ color: "#247ba0" }}>{(p.addr || "").split(",")[0]}</div>
                  </div>
                  <div className="text-xs text-right flex-shrink-0" style={{ color: "#247ba0" }}>
                    <div>{p.zones?.length || 0} зони</div>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && !loading && (
                <div className="text-center py-12" style={{ color: "#247ba0" }}>
                  <div className="text-4xl mb-3">🔍</div>
                  <div className="text-sm">Няма намерени обекти</div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "tours" && subTab === "tasks" && (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <button
              onClick={() => setShowTaskForm(true)}
              className="w-full mb-3 min-h-[44px] md:min-h-0 md:h-10 py-3 md:py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(140deg, #1b98e0, #006494)" }}>
              ➕ Нова задача
            </button>

            {/* Bulk Assign Section */}
            {properties.length > 0 && taskTemplates.length > 0 && (
              <div className="mb-4 p-4 rounded-xl border bg-white" style={{ borderColor: "#e4e9f0" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold" style={{ color: "#006494" }}>
                    📦 Групово възлагане
                  </span>
                  {bulkSelected.size > 0 && (
                    <span className="text-xs font-semibold" style={{ color: "#1b98e0" }}>
                      {bulkSelected.size} избрани
                    </span>
                  )}
                </div>
                {!showBulkForm ? (
                  <>
                    <div className="max-h-40 overflow-y-auto space-y-1 mb-3">
                      {properties.map((p: any) => (
                        <label
                          key={p.id}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition hover:bg-gray-50"
                          style={{ fontSize: 14 }}
                        >
                          <input
                            type="checkbox"
                            checked={bulkSelected.has(p.id)}
                            onChange={() => {
                              setBulkSelected(prev => {
                                const next = new Set(prev);
                                if (next.has(p.id)) next.delete(p.id);
                                else next.add(p.id);
                                return next;
                              });
                            }}
                            className="w-4 h-4 accent-[#1b98e0]"
                          />
                          <span className="truncate" style={{ color: "#006494" }}>{p.name}</span>
                          <span className="text-xs ml-auto flex-shrink-0" style={{ color: "#247ba0" }}>
                            {p.addr?.split(",")[0] || ""}
                          </span>
                        </label>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        if (bulkSelected.size === 0) {
                          showToast("❌ Избери поне един имот");
                          return;
                        }
                        setShowBulkForm(true);
                        // Load users for the bulk form
                        fetch("/api/users")
                          .then(r => r.json())
                          .then(d => setBulkUsers((d.users || []).filter((x: any) => x.active)))
                          .catch(() => {});
                      }}
                      disabled={bulkSelected.size === 0}
                      className="w-full min-h-[44px] py-2.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40 transition"
                      style={{ background: "linear-gradient(140deg, #a663cc, #7c3aed)" }}>
                      ⚡ Възложи на избраните ({bulkSelected.size})
                    </button>
                  </>
                ) : (
                  <div className="space-y-3" onClick={e => e.stopPropagation()}>
                    <select
                      value={bulkTemplateId}
                      onChange={e => setBulkTemplateId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border text-base"
                      style={{ borderColor: "#e4e9f0", fontSize: 16, color: "#006494" }}>
                      <option value="">📋 Избери шаблон</option>
                      {taskTemplates.map((t: any) => (
                        <option key={t.id} value={t.id}>{t.icon || "📋"} {t.name} ({t.duration_min} мин)</option>
                      ))}
                    </select>

                    <select
                      value={bulkAssigneeId}
                      onChange={e => setBulkAssigneeId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border text-base"
                      style={{ borderColor: "#e4e9f0", fontSize: 16, color: "#006494" }}>
                      <option value="">👷 Избери работник (по избор)</option>
                      {bulkUsers.map((u: any) => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                      ))}
                    </select>

                    <input
                      type="datetime-local"
                      value={bulkPlannedAt}
                      onChange={e => setBulkPlannedAt(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border text-base"
                      style={{ borderColor: "#e4e9f0", fontSize: 16, color: "#006494" }}
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowBulkForm(false)}
                        className="flex-1 min-h-[44px] py-3 rounded-xl text-sm font-semibold border"
                        style={{ borderColor: "#d0e5ff", color: "#247ba0" }}>
                        Отказ
                      </button>
                      <button
                        onClick={handleBulkAssign}
                        disabled={bulkSubmitting}
                        className="flex-1 min-h-[44px] py-3 rounded-xl text-sm font-semibold text-white transition"
                        style={{ background: "linear-gradient(140deg, #1b98e0, #006494)" }}>
                        {bulkSubmitting ? "⏳ Изпращане..." : `📤 Възложи на ${bulkSelected.size} имота`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              {taskTemplatesLoading ? (
                <div className="text-center py-12" style={{ color: "#247ba0" }}>Зареждане...</div>
              ) : taskTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-16">
                  <div className="text-5xl mb-4">📋</div>
                  <h3 className="text-lg font-bold mb-2" style={{ color: "#006494" }}>Няма създадени шаблони</h3>
                  <p className="text-sm max-w-xs" style={{ color: "#247ba0" }}>
                    Създай шаблони за обходи в секция Настройки → Шаблони.
                  </p>
                </div>
              ) : (
                taskTemplates.map((tpl) => {
                  const itemCount = tpl.items?.length || 0;
                  return (
                <div key={tpl.id} className="p-4 rounded-xl bg-white border" style={{ borderColor: "#e4e9f0" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{tpl.icon || "📋"}</span>
                    <span className="text-sm font-bold" style={{ color: "#006494" }}>{tpl.name}</span>
                    <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: "#e8f1f2", color: "#247ba0" }}>
                      {tpl.duration_min} мин
                    </span>
                  </div>
                  <div className="text-xs mb-3" style={{ color: "#247ba0" }}>
                    {itemCount} точки в чек-листа
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setActiveChecklist({ name: tpl.name, addr: "Избери обект от картата" })}
                      className="flex-1 min-h-[44px] py-2.5 rounded-lg text-xs font-semibold text-white min-w-[120px]"
                      style={{ background: "linear-gradient(140deg, #1b98e0, #006494)" }}>
                      ▶ Започни обход
                    </button>
                    <button className="px-4 min-h-[44px] py-2.5 rounded-lg text-xs font-semibold border" style={{ borderColor: "#d0e5ff", color: "#006494" }}>
                      👁 Преглед
                    </button>
                    <button
                      onClick={handleReportProblem}
                      className="px-4 min-h-[44px] py-2.5 rounded-lg text-xs font-semibold border"
                      style={{ borderColor: "#fed7aa", color: "#c2410c", background: "#fff7ed" }}>
                      ⚠️ Докладвай проблем
                    </button>
                    <button
                      onClick={() => { setTab("settings"); setSubTab("templates"); }}
                      className="w-full min-h-[44px] py-2.5 rounded-lg text-xs font-semibold border mt-1"
                      style={{ borderColor: "#a663cc", color: "#a663cc", background: "#faf5ff" }}>
                      📋 Редактирай шаблон
                    </button>
                  </div>
                </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {tab === "issues" && subTab === "fixes" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Decision filter buttons */}
            <div className="flex gap-1 px-4 py-2 overflow-x-auto flex-shrink-0 border-b" style={{ borderColor: "#e4e9f0" }}>
              {[
                { key: "all", label: "Всички" },
                { key: "pending", label: "⏳ Чакащи" },
                { key: "accepted", label: "✅ Приети" },
                { key: "paid", label: "💳 Платени" },
                { key: "in_progress", label: "🔧 В процес" },
                { key: "done", label: "🏁 Завършени" },
                { key: "declined", label: "❌ Отказани" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFixesDecisionFilter(f.key)}
                  className="px-3 min-h-[36px] py-1.5 text-xs font-semibold rounded-full transition whitespace-nowrap"
                  style={{
                    fontSize: 13,
                    background: fixesDecisionFilter === f.key ? "#1b98e0" : "transparent",
                    color: fixesDecisionFilter === f.key ? "#fff" : "#247ba0",
                    border: fixesDecisionFilter === f.key ? "none" : "1px solid #e4e9f0",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <OffersPanel decisionFilter={fixesDecisionFilter} onPay={handleOpenPayment} />
          </div>
        )}

        {tab === "issues" && subTab === "findings" && (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {findingsLoading ? (
              <div className="text-center py-12" style={{ color: "#247ba0" }}>Зареждане...</div>
            ) : findings.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16">
                <div className="text-5xl mb-4">⚠️</div>
                <h3 className="text-lg font-bold mb-2" style={{ color: "#006494" }}>Няма констатации</h3>
                <p className="text-sm max-w-xs" style={{ color: "#247ba0" }}>
                  При обход можеш да докладваш проблеми — те ще се появят тук с оферти за ремонт.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-bold" style={{ color: "#006494" }}>
                    Общо {findings.length} констатации
                  </span>
                  <button
                    onClick={handleReportProblem}
                    className="ml-auto px-4 py-2 rounded-lg text-xs font-semibold border"
                    style={{ borderColor: "#fed7aa", color: "#c2410c", background: "#fff7ed" }}>
                    ⚠️ Докладвай проблем
                  </button>
                </div>

                {/* Filter buttons for findings */}
                <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
                  {[
                    { key: "all", label: "Всички" },
                    { key: "open", label: "🔴 Отворени" },
                    { key: "in_progress", label: "🟡 В процес" },
                    { key: "resolved", label: "🟢 Решени" },
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setFindingsStatusFilter(f.key)}
                      className="px-3 min-h-[36px] py-1.5 text-xs font-semibold rounded-full transition whitespace-nowrap"
                      style={{
                        fontSize: 13,
                        background: findingsStatusFilter === f.key ? "#1b98e0" : "transparent",
                        color: findingsStatusFilter === f.key ? "#fff" : "#247ba0",
                        border: findingsStatusFilter === f.key ? "none" : "1px solid #e4e9f0",
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {findings.map((f) => {
                    const typeColors: Record<string, string> = {
                      "Теч": "#dc2626",
                      "Мухъл/влага": "#a663cc",
                      "Повреда": "#d97706",
                      "Липса": "#0891b2",
                      "Друго": "#64748b",
                    };
                    return (
                      <>
                      <button
                        key={f.id}
                        onClick={() => f.offer ? setSelectedFinding(f) : null}
                        className="w-full flex items-start gap-3 p-4 rounded-xl border bg-white text-left transition hover:shadow-md"
                        style={{ borderColor: "#e4e9f0" }}>
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-md mt-0.5 flex-shrink-0"
                          style={{
                            background: `${typeColors[f.type] || "#64748b"}18`,
                            color: typeColors[f.type] || "#64748b",
                          }}>
                          {f.type}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold" style={{ color: "#006494" }}>{f.title}</div>
                          <div className="text-xs truncate mt-0.5" style={{ color: "#247ba0" }}>
                            {f.propertyName} · {f.body?.slice(0, 60)}{(f.body?.length || 0) > 60 ? "..." : ""}
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          {f.offer ? (
                            f.offer.decision === "accepted" ? (
                              <span className="text-xs font-bold px-2 py-1 rounded-md" style={{ background: "#dcfce7", color: "#16a34a" }}>✓ Приета</span>
                            ) : f.offer.decision === "declined" ? (
                              <span className="text-xs font-bold px-2 py-1 rounded-md" style={{ background: "#fee2e2", color: "#dc2626" }}>✕ Отказана</span>
                            ) : (
                              <span className="text-xs font-bold px-2 py-1 rounded-md" style={{ background: "#fef3c7", color: "#d97706" }}>
                                {f.offer.price.toFixed(0)} лв
                              </span>
                            )
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setOfferFindingId(f.id); setOfferPrice(""); setOfferDays(""); setOfferScope(""); }}
                              className="text-xs font-bold px-2 py-1 rounded-md transition hover:opacity-80"
                              style={{ background: "#dbeafe", color: "#1b98e0" }}
                            >
                              ➕ Оферта
                            </button>
                          )}
                        </div>
                      </button>
                      {offerFindingId === f.id && (
                        <div
                          className="p-4 rounded-xl border bg-white"
                          style={{ borderColor: "#e4e9f0" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="text-sm font-bold mb-3" style={{ color: "#006494" }}>Нова оферта за {f.title}</div>
                          <div className="space-y-2">
                            <div>
                              <label className="text-xs font-semibold block mb-1" style={{ color: "#247ba0" }}>Цена (лв)</label>
                              <input
                                type="number"
                                value={offerPrice}
                                onChange={(e) => setOfferPrice(e.target.value)}
                                placeholder="Напр. 150"
                                className="w-full px-3 py-2 rounded-lg border text-sm"
                                style={{ fontSize: 16, borderColor: "#e4e9f0", color: "#006494" }}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold block mb-1" style={{ color: "#247ba0" }}>Срок (дни)</label>
                              <input
                                type="number"
                                value={offerDays}
                                onChange={(e) => setOfferDays(e.target.value)}
                                placeholder="Напр. 5"
                                className="w-full px-3 py-2 rounded-lg border text-sm"
                                style={{ fontSize: 16, borderColor: "#e4e9f0", color: "#006494" }}
                              />
                            </div>
                            <div>
                              <label className="text-xs font-semibold block mb-1" style={{ color: "#247ba0" }}>Обхват</label>
                              <textarea
                                value={offerScope}
                                onChange={(e) => setOfferScope(e.target.value)}
                                placeholder="Описание на работата..."
                                rows={3}
                                className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                                style={{ fontSize: 16, borderColor: "#e4e9f0", color: "#006494" }}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={async () => {
                                const price = parseFloat(offerPrice);
                                const days = parseInt(offerDays, 10);
                                if (!price || !days || !offerScope.trim()) {
                                  showToast("❌ Попълнете цена, срок и обхват");
                                  return;
                                }
                                try {
                                  const res = await fetch("/api/offers", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      finding_id: f.id,
                                      price,
                                      days,
                                      scope: offerScope.trim(),
                                    }),
                                  });
                                  if (res.ok) {
                                    showToast("✅ Офертата е създадена");
                                    loadFindings();
                                  } else {
                                    const err = await res.json().catch(() => ({}));
                                    showToast("❌ " + (err.error || "Грешка при създаване"));
                                  }
                                } catch {
                                  showToast("❌ Грешка при създаване");
                                }
                                setOfferFindingId(null);
                                setOfferPrice("");
                                setOfferDays("");
                                setOfferScope("");
                              }}
                              className="flex-1 min-h-[44px] py-2 rounded-lg text-xs font-semibold text-white"
                              style={{ background: "linear-gradient(140deg, #1b98e0, #006494)" }}
                            >
                              💾 Запази оферта
                            </button>
                            <button
                              onClick={() => { setOfferFindingId(null); setOfferPrice(""); setOfferDays(""); setOfferScope(""); }}
                              className="flex-1 min-h-[44px] py-2 rounded-lg text-xs font-semibold border"
                              style={{ borderColor: "#e4e9f0", color: "#247ba0" }}
                            >
                              Отказ
                            </button>
                          </div>
                        </div>
                      )}
                      </>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {tab === "tours" && subTab === "history" && <HistoryList />}

        {tab === "tours" && subTab === "calendar" && (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {/* Filter buttons */}
            <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
              {[
                { key: "all", label: "Всички" },
                { key: "planned", label: "📅 Планирани" },
                { key: "in_progress", label: "🔄 Активни" },
                { key: "completed", label: "✅ Завършени" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setCalendarFilter(f.key)}
                  className="px-3 min-h-[36px] py-1.5 text-xs font-semibold rounded-full transition whitespace-nowrap"
                  style={{
                    fontSize: 13,
                    background: calendarFilter === f.key ? "#1b98e0" : "transparent",
                    color: calendarFilter === f.key ? "#fff" : "#247ba0",
                    border: calendarFilter === f.key ? "none" : "1px solid #e4e9f0",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {calendarLoading ? (
              <div className="text-center py-12" style={{ color: "#247ba0" }}>Зареждане...</div>
            ) : calendarJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16">
                <div className="text-5xl mb-4">📅</div>
                <h3 className="text-lg font-bold mb-2" style={{ color: "#006494" }}>Няма планирани обходи</h3>
                <p className="text-sm max-w-xs" style={{ color: "#247ba0" }}>
                  Тук ще виждаш предстоящите и завършени обходи, групирани по дата.
                </p>
              </div>
            ) : (() => {
              const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
                ok: { label: "Изпълнен", bg: "#dcfce7", color: "#16a34a" },
                planned: { label: "Предстои", bg: "#fef3c7", color: "#d97706" },
                bad: { label: "Проблем", bg: "#fee2e2", color: "#dc2626" },
              };
              const fallback = STATUS_BADGE.planned;

              // Group by date
              const grouped: Record<string, any[]> = {};
              for (const job of calendarJobs) {
                const dateField = job.planned_at || job.date;
                const date = dateField ? dateField.slice(0, 10) : "Без дата";
                if (!grouped[date]) grouped[date] = [];
                grouped[date].push(job);
              }

              const sortedDates = Object.keys(grouped).sort((a, b) =>
                a === "Без дата" ? 1 : b === "Без дата" ? -1 : a.localeCompare(b)
              );

              return (
                <div className="space-y-4">
                  {sortedDates.map((date) => {
                    const today = new Date().toISOString().slice(0, 10);
                    const badge = date === today ? "ДНЕС" : null;
                    const formatted = date === "Без дата" ? "Без дата" : (() => {
                      try { return new Date(date).toLocaleDateString("bg-BG", { weekday: "long", day: "numeric", month: "long" }); }
                      catch { return date; }
                    })();

                    return (
                      <div key={date}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-bold" style={{ color: "#006494" }}>
                            {formatted}
                          </span>
                          {badge && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#dbeafe", color: "#1b98e0" }}>
                              {badge}
                            </span>
                          )}
                        </div>
                        <div className="space-y-2">
                          {grouped[date].map((job) => {
                            const status = STATUS_BADGE[job.status] || fallback;
                            const dateField = job.planned_at || job.date;
                            const time = dateField
                              ? new Date(dateField).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" })
                              : "--:--";
                            return (
                              <div
                                key={job.id}
                                className="flex items-start gap-3 p-4 rounded-xl border bg-white transition hover:shadow-md"
                                style={{ borderColor: "#e4e9f0" }}
                              >
                                {/* Timeline dot */}
                                <div className="flex flex-col items-center pt-1">
                                  <div
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ background: status.color }}
                                  />
                                  <div className="w-0.5 flex-1 mt-1" style={{ background: "#e4e9f0", minHeight: "12px" }} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold" style={{ color: "#006494" }}>
                                      {job.property_name || job.propertyName || "Имот"}
                                    </span>
                                    <span className="text-xs" style={{ color: "#247ba0" }}>{time}</span>
                                  </div>
                                  {(job.assignee_name || job.worker) && (
                                    <div className="text-xs mt-0.5" style={{ color: "#247ba0" }}>
                                      👤 {job.assignee_name || job.worker}
                                    </div>
                                  )}
                                </div>
                                <span
                                  className="text-xs font-bold px-2 py-1 rounded-md flex-shrink-0"
                                  style={{ background: status.bg, color: status.color }}
                                >
                                  {status.label}
                                </span>
                                {job.status === "planned" && (
                                  <button
                                    onClick={() => handleDeleteJob(job.id)}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm hover:bg-red-50 transition flex-shrink-0"
                                    title="Изтрий задача"
                                    style={{ fontSize: 16 }}
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {tab === "settings" && subTab === "team" && (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {teamLoading ? (
              <div className="text-center py-12" style={{ color: "#247ba0" }}>Зареждане...</div>
            ) : teamUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16">
                <div className="text-5xl mb-4">👥</div>
                <h3 className="text-lg font-bold mb-2" style={{ color: "#006494" }}>Няма потребители</h3>
                <p className="text-sm max-w-xs" style={{ color: "#247ba0" }}>
                  Екипът ще се появи тук след като бъдат добавени потребители.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {teamUsers.map((u) => {
                  const roleBadge = ROLE_BADGE[u.role];
                  const initial = (u.name || "?").charAt(0).toUpperCase();
                  const isEditing = editingUserId === u.id;

                  if (isEditing) {
                    return (
                      <div
                        key={u.id}
                        className="p-4 rounded-xl border bg-white"
                        style={{ borderColor: "#e4e9f0" }}
                      >
                        <div className="flex flex-col gap-3">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Име"
                            className="w-full px-3 py-2 rounded-lg border text-sm"
                            style={{ fontSize: 16, borderColor: "#e4e9f0", color: "#006494" }}
                          />
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value as UserRole)}
                            className="w-full px-3 py-2 rounded-lg border text-sm"
                            style={{ fontSize: 16, borderColor: "#e4e9f0", color: "#006494" }}
                          >
                            <option value="admin">Админ</option>
                            <option value="client">Клиент</option>
                            <option value="inspector">Инспектор</option>
                          </select>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditSave(u.id)}
                              className="flex-1 min-h-[44px] py-2 rounded-lg text-xs font-semibold text-white"
                              style={{ background: "linear-gradient(140deg, #1b98e0, #006494)" }}
                            >
                              💾 Запази
                            </button>
                            <button
                              onClick={handleEditCancel}
                              className="flex-1 min-h-[44px] py-2 rounded-lg text-xs font-semibold border"
                              style={{ borderColor: "#e4e9f0", color: "#247ba0" }}
                            >
                              Отказ
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={u.id}
                      className="flex items-center gap-3 p-4 rounded-xl border bg-white transition hover:shadow-md"
                      style={{ borderColor: "#e4e9f0" }}
                    >
                      {/* Avatar */}
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                        style={{
                          background: roleBadge
                            ? `linear-gradient(140deg, ${roleBadge.color}, #006494)`
                            : "linear-gradient(140deg, #a663cc, #247ba0)",
                        }}
                      >
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold" style={{ color: "#006494" }}>{u.name}</div>
                        <div className="text-xs truncate" style={{ color: "#247ba0" }}>{u.email}</div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {roleBadge && (
                          <span
                            className="text-xs font-bold px-2 py-1 rounded-md"
                            style={{
                              background: roleBadge.color + "18",
                              color: roleBadge.color,
                              border: `1px solid ${roleBadge.color}40`,
                            }}
                          >
                            {roleBadge.label}
                          </span>
                        )}
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: u.active !== false ? "#16a34a" : "#dc2626" }}
                          title={u.active !== false ? "Активен" : "Неактивен"}
                        />
                      </div>
                      {/* Action buttons */}
                      <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                        <button
                          onClick={() => handleEditStart(u)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm hover:bg-gray-100 transition"
                          title="Редактирай"
                          style={{ fontSize: 16 }}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm hover:bg-red-50 transition"
                          title="Деактивирай"
                          style={{ fontSize: 16 }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "settings" && subTab === "templates" && <TemplateManager />}

        {tab === "settings" && subTab === "mailing" && <SmtpSettings />}

        {tab === "profile" && <ClientProfile />}

        {/* FAB — context-aware per tab */}
        {(() => {
            if (userRole !== "admin") return null;
            const isMap = tab === "map" || tab === "props";
            const isFindings = tab === "issues" && subTab === "findings";
            if (!isMap && !isFindings) return null;
            return (
              <button
                onClick={() => isFindings ? handleReportProblem() : setShowAddForm(true)}
                className="absolute bottom-6 right-6 w-14 h-14 rounded-2xl text-white text-2xl flex items-center justify-center shadow-lg transition hover:scale-105 z-30"
                style={{ background: "linear-gradient(140deg, #1b98e0, #006494)", boxShadow: "0 6px 20px rgba(0,100,148,0.4)" }}>
                {isFindings ? "⚠️" : "＋"}
              </button>
            );
          })()}
      </main>

      {selectedProperty && <PropertySheet property={selectedProperty} onClose={() => setSelectedProperty(null)} />}
      {showAddForm && (
        <PropertyForm
          onAdd={async (data) => {
            if (!data.lat || !data.lng) {
              showToast("❌ Моля, геокодирайте адреса първо");
              return;
            }
            try {
              const res = await fetch("/api/properties", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: data.name,
                  city: data.city,
                  address: data.addr,
                  lat: data.lat,
                  lng: data.lng,
                  kind: data.type,
                }),
              });
              if (res.ok) {
                const prop = await res.json();
                showToast("✅ Обектът е добавен");
                setShowAddForm(false);
                setNewPropertyId(prop.id);
              } else {
                showToast("❌ Грешка при добавяне");
              }
            } catch {
              showToast("❌ Грешка при добавяне");
            }
          }}
          onClose={() => setShowAddForm(false)}
        />
      )}
      {newPropertyId && (
        <PlanSelector
          propertyId={newPropertyId}
          onDone={() => { setNewPropertyId(null); window.location.reload(); }}
        />
      )}
      {showTaskForm && (
        <TaskForm
          onSave={handleTaskSave}
          onClose={() => setShowTaskForm(false)}
        />
      )}

      {activeChecklist && (
        <ChecklistSheet
          propertyName={activeChecklist.name}
          propertyAddr={activeChecklist.addr}
          onClose={() => setActiveChecklist(null)}
          onReportProblem={handleChecklistReportProblem}
          onComplete={(data) => {
            const done = data.items.filter(i => i.done).length;
            showToast(`✅ Обход завършен: ${done}/${data.items.length} точки`);
            setActiveChecklist(null);
          }}
        />
      )}

      {showFindings && (
        <FindingsSheet
          onClose={() => { setShowFindings(false); setReportProblemContext(null); }}
          onSave={handleSaveFinding}
          propertyId={reportProblemContext?.propertyId}
          jobId={reportProblemContext?.jobId}
          jobItemId={reportProblemContext?.jobItemId}
        />
      )}

      {selectedFinding && (
        <>
          {/* Mobile: fullscreen modal */}
          <div
            className="fixed inset-0 z-50 flex flex-col md:hidden"
            style={{ background: "#fff" }}
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
              style={{ borderColor: "#e4e9f0" }}
            >
              <div className="flex-1 min-w-0">
                <h3
                  className="text-lg font-bold"
                  style={{ color: "#006494" }}
                >
                  Детайли за оферта
                </h3>
              </div>
              <button
                onClick={() => setSelectedFinding(null)}
                className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full flex items-center justify-center"
                style={{ background: "#f1f5f9", color: "#64748b", fontSize: 15 }}
              >
                ✕
              </button>
            </div>
            <OffersPanel findingId={selectedFinding.id} onPay={handleOpenPayment} />
          </div>

          {/* Desktop: right side panel */}
          <div className="hidden md:block fixed inset-0 z-40 bg-black/30" onClick={() => setSelectedFinding(null)} />
          <div
            className="hidden md:flex md:flex-col fixed right-0 top-0 bottom-0 z-50 bg-white shadow-2xl md:w-[460px] md:max-w-[90vw]"
            style={{ borderLeft: "1px solid #e4e9f0" }}
          >
            <div
              className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
              style={{ borderColor: "#e4e9f0" }}
            >
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold" style={{ color: "#006494" }}>Детайли за оферта</h3>
              </div>
              <button
                onClick={() => setSelectedFinding(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm hover:bg-gray-100 transition"
                style={{ background: "#f1f5f9", color: "#64748b" }}
              >
                ✕
              </button>
            </div>
            <OffersPanel findingId={selectedFinding.id} onPay={handleOpenPayment} />
          </div>
        </>
      )}

      {showPayment && (
        <PaymentPanel
          offerId={paymentOfferId}
          price={paymentPrice}
          title={paymentTitle}
          onClose={() => setShowPayment(false)}
          onPaid={handlePaymentComplete}
        />
      )}

      {toast && (
        <div className="fixed bottom-[max(96px,calc(96px+env(safe-area-inset-bottom)))] left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full text-white text-sm font-semibold shadow-lg flex items-center gap-3"
          style={{ background: "#006494" }}>
          <span>{toast}</span>
          <button
            onClick={() => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); setToast(""); }}
            className="w-5 h-5 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition text-xs font-bold"
            style={{ lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ====== CLOSE main content area & flex container ====== */}
      </div>
      </div>
    </div>
  );
}
