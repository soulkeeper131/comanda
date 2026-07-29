"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Topbar from "@/components/Topbar";
import MapView from "@/components/MapView";
import PropertySheet from "@/components/PropertySheet";
import PropertyForm from "@/components/PropertyForm";
import ChecklistSheet from "@/components/ChecklistSheet";
import FindingsSheet from "@/components/FindingsSheet";
import OffersPanel from "@/components/OffersPanel";
import HistoryList from "@/components/HistoryList";

type UserRole = "admin" | "owner" | "worker" | "inspector";

type TabDef = { id: string; label: string; roles: UserRole[] };

const ALL_TABS: TabDef[] = [
  { id: "map", label: "🗺️ Карта", roles: ["admin", "owner", "worker", "inspector"] },
  { id: "calendar", label: "📅 Календар", roles: ["admin", "owner", "inspector"] },
  { id: "tasks", label: "📋 Задачи", roles: ["admin", "worker"] },
  { id: "fixes", label: "🔧 Ремонти", roles: ["admin"] },
  { id: "findings", label: "⚠️ Констатации", roles: ["admin"] },
  { id: "props", label: "🏠 Обекти", roles: ["admin", "owner", "inspector"] },
  { id: "history", label: "📊 История", roles: ["admin", "owner", "inspector"] },
  { id: "team", label: "👥 Екип", roles: ["admin"] },
];

const TASKS = [
  { id: "t1", icon: "❄️", name: "Зимен обход (стандартен)", mins: 40, items: 12 },
  { id: "t2", icon: "☀️", name: "Летен обход (стандартен)", mins: 55, items: 15 },
];

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  admin: { label: "Админ", color: "#a663cc" },
  owner: { label: "Собственик", color: "#1b98e0" },
  worker: { label: "Работник", color: "#247ba0" },
  inspector: { label: "Инспектор", color: "#d97706" },
};

export default function DashboardPage() {
  const [tab, setTab] = useState("map");
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeChecklist, setActiveChecklist] = useState<{ name: string; addr: string } | null>(null);
  const [showFindings, setShowFindings] = useState(false);
  const [findings, setFindings] = useState<any[]>([]);
  const [findingsLoading, setFindingsLoading] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole>("admin");
  const [roleLoading, setRoleLoading] = useState(true);

  // Календар state
  const [calendarJobs, setCalendarJobs] = useState<any[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Екип state
  const [teamUsers, setTeamUsers] = useState<any[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);

  // Inline edit state for Team tab
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("worker");

  // Fetch user role
  useEffect(() => {
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.role) setUserRole(data.role as UserRole);
        setRoleLoading(false);
      })
      .catch(() => setRoleLoading(false));
  }, []);

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
      setTab(TABS[0].id);
    }
  }, [roleLoading, TABS, tab]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
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
            status: "ok" as string,
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
      const res = await fetch("/api/findings");
      if (res.ok) {
        const data = await res.json();
        setFindings(data);
      }
    } catch (e) {
      console.error("Findings load error:", e);
    } finally {
      setFindingsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  useEffect(() => {
    if (tab === "findings" || tab === "fixes") {
      loadFindings();
    }
  }, [tab, loadFindings]);

  // Fetch calendar jobs
  useEffect(() => {
    if (tab !== "calendar") return;
    setCalendarLoading(true);
    fetch("/api/jobs")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setCalendarJobs(Array.isArray(data) ? data : []))
      .catch(() => setCalendarJobs([]))
      .finally(() => setCalendarLoading(false));
  }, [tab]);

  // Fetch team users
  useEffect(() => {
    if (tab !== "team") return;
    setTeamLoading(true);
    fetch("/api/users")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setTeamUsers(Array.isArray(data) ? data : []))
      .catch(() => setTeamUsers([]))
      .finally(() => setTeamLoading(false));
  }, [tab]);

  const handleEditStart = (user: any) => {
    setEditingUserId(user.id);
    setEditName(user.name || "");
    setEditRole((user.role as UserRole) || "worker");
  };

  const handleEditCancel = () => {
    setEditingUserId(null);
    setEditName("");
    setEditRole("worker");
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
    setShowFindings(true);
  };

  const handleSaveFinding = async (data: { type: string; title: string; body: string }) => {
    try {
      const res = await fetch("/api/findings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: data.type,
          title: data.title,
          body: data.body,
          propertyId: "p1",
        }),
      });
      if (res.ok) {
        showToast("✅ Проблемът е докладван");
        setShowFindings(false);
        loadFindings();
      } else {
        showToast("❌ Грешка при докладване");
      }
    } catch {
      showToast("❌ Грешка при докладване");
    }
  };

  const handleAcceptOffer = (findingId: string) => {
    setFindings((prev) =>
      prev.map((f) =>
        f.id === findingId && f.offer
          ? { ...f, offer: { ...f.offer, decision: "accepted" } }
          : f
      )
    );
    showToast("✅ Офертата е приета");
    setSelectedFinding(null);
  };

  const handleDeclineOffer = (findingId: string) => {
    setFindings((prev) =>
      prev.map((f) =>
        f.id === findingId && f.offer
          ? { ...f, offer: { ...f.offer, decision: "declined" } }
          : f
      )
    );
    showToast("❌ Офертата е отказана");
    setSelectedFinding(null);
  };

  const findingsWithOffers = findings.filter((f) => f.offer);

  const showFAB = userRole === "admin";

  if (roleLoading) {
    return (
      <div className="flex flex-col h-[100dvh] items-center justify-center" style={{ backgroundColor: "#e8f1f2" }}>
        <div className="text-lg" style={{ color: "#247ba0" }}>Зареждане...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh]" style={{ backgroundColor: "#e8f1f2" }}>
      <Topbar />

      <div className="flex gap-0 border-b flex-shrink-0 overflow-x-auto px-2"
        style={{ background: "rgba(255,255,255,0.7)", backdropFilter: "blur(14px)", borderColor: "#e4e9f0" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-4 min-h-[44px] py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition leading-[44px]"
            style={{ fontSize: 14, color: tab === t.id ? "#1b98e0" : "#247ba0", borderColor: tab === t.id ? "#1b98e0" : "transparent" }}>
            {t.label}
          </button>
        ))}
      </div>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#e8f1f2" }}>
            <div className="text-lg" style={{ color: "#247ba0" }}>Зареждане...</div>
          </div>
        )}

        {tab === "map" && (
          <MapView
            properties={properties.map((p: any) => ({
              id: p.id,
              name: p.name,
              address: p.addr,
              lat: p.lat,
              lng: p.lng,
              status: (p.status || "ok") as "ok" | "warn" | "bad",
              kind: p.kind || "",
              zones: p.zones || [],
              accessNotes: p.access || "",
              lastVisit: p.lastVisit || "",
              plan: p.plan || "",
            }))}
            onPropertyClick={(p) => setSelectedProperty(p as any)}
          />
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

        {tab === "tasks" && (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-2">
              {TASKS.map((tpl) => (
                <div key={tpl.id} className="p-4 rounded-xl bg-white border" style={{ borderColor: "#e4e9f0" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{tpl.icon}</span>
                    <span className="text-sm font-bold" style={{ color: "#006494" }}>{tpl.name}</span>
                    <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: "#e8f1f2", color: "#247ba0" }}>
                      {tpl.mins} мин
                    </span>
                  </div>
                  <div className="text-xs mb-3" style={{ color: "#247ba0" }}>
                    {tpl.items} точки в чек-листа
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
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "fixes" && (
          findingsWithOffers.length > 0 ? (
            <OffersPanel
              findings={findingsWithOffers}
              onAccept={handleAcceptOffer}
              onDecline={handleDeclineOffer}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <div className="text-4xl mb-4">🔧</div>
                <h3 className="text-lg font-bold mb-2" style={{ color: "#006494" }}>Ремонти</h3>
                <p className="text-sm" style={{ color: "#247ba0" }}>Проследяване на ремонти — от констатация до приключване.</p>
              </div>
            </div>
          )
        )}

        {tab === "findings" && (
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
                            <span className="text-xs px-2 py-1 rounded-md" style={{ background: "#f1f5f9", color: "#64748b" }}>Няма оферта</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {tab === "history" && <HistoryList />}

        {tab === "calendar" && (
          <div className="flex-1 overflow-y-auto px-4 py-4">
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
                planned: { label: "Планиран", bg: "#dbeafe", color: "#1b98e0" },
                completed: { label: "Завършен", bg: "#dcfce7", color: "#16a34a" },
                missed: { label: "Пропуснат", bg: "#fee2e2", color: "#dc2626" },
              };

              // Group by date
              const grouped: Record<string, any[]> = {};
              for (const job of calendarJobs) {
                const date = job.planned_at ? job.planned_at.slice(0, 10) : "Без дата";
                if (!grouped[date]) grouped[date] = [];
                grouped[date].push(job);
              }

              const sortedDates = Object.keys(grouped).sort((a, b) =>
                a === "Без дата" ? 1 : b === "Без дата" ? -1 : a.localeCompare(b)
              );

              return (
                <div className="space-y-4">
                  {sortedDates.map((date) => {
                    const badge = date === new Date().toISOString().slice(0, 10) ? "ДНЕС" : null;
                    const formatted = date === "Без дата" ? "Без дата" : new Date(date).toLocaleDateString("bg-BG", { weekday: "long", day: "numeric", month: "long" });

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
                            const status = STATUS_BADGE[job.status] || STATUS_BADGE.planned;
                            const time = job.planned_at
                              ? new Date(job.planned_at).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" })
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
                                      {job.property_name || "Имот"}
                                    </span>
                                    <span className="text-xs" style={{ color: "#247ba0" }}>{time}</span>
                                  </div>
                                  {job.worker_name && (
                                    <div className="text-xs mt-0.5" style={{ color: "#247ba0" }}>
                                      👤 {job.worker_name}
                                    </div>
                                  )}
                                </div>
                                <span
                                  className="text-xs font-bold px-2 py-1 rounded-md flex-shrink-0"
                                  style={{ background: status.bg, color: status.color }}
                                >
                                  {status.label}
                                </span>
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

        {tab === "team" && (
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
                            <option value="owner">Собственик</option>
                            <option value="worker">Работник</option>
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

        {/* FAB - only Admin */}
        {showFAB && (
          <button
            onClick={() => setShowAddForm(true)}
            className="absolute bottom-6 right-6 w-14 h-14 rounded-2xl text-white text-2xl flex items-center justify-center shadow-lg transition hover:scale-105 z-30"
            style={{ background: "linear-gradient(140deg, #1b98e0, #006494)", boxShadow: "0 6px 20px rgba(0,100,148,0.4)" }}>
            ＋
          </button>
        )}
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
                  address: data.addr,
                  lat: data.lat,
                  lng: data.lng,
                  kind: data.type,
                }),
              });
              if (res.ok) {
                showToast("✅ Обектът е добавен");
                window.location.reload();
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

      {activeChecklist && (
        <ChecklistSheet
          propertyName={activeChecklist.name}
          propertyAddr={activeChecklist.addr}
          onClose={() => setActiveChecklist(null)}
          onComplete={(data) => {
            const done = data.items.filter(i => i.done).length;
            showToast(`✅ Обход завършен: ${done}/${data.items.length} точки`);
            setActiveChecklist(null);
          }}
        />
      )}

      {showFindings && (
        <FindingsSheet
          onClose={() => setShowFindings(false)}
          onSave={handleSaveFinding}
        />
      )}

      {selectedFinding && (
        <OffersPanel
          findings={[selectedFinding]}
          onAccept={handleAcceptOffer}
          onDecline={handleDeclineOffer}
        />
      )}

      {toast && (
        <div className="fixed bottom-[max(96px,calc(96px+env(safe-area-inset-bottom)))] left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full text-white text-sm font-semibold shadow-lg"
          style={{ background: "#006494" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
