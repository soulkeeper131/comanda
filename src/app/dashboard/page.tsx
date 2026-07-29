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
  { id: "tasks", label: "📋 Задачи", roles: ["admin", "worker"] },
  { id: "fixes", label: "🔧 Ремонти", roles: ["admin"] },
  { id: "findings", label: "⚠️ Констатации", roles: ["admin"] },
  { id: "props", label: "🏠 Обекти", roles: ["admin", "owner", "inspector"] },
  { id: "history", label: "📊 История", roles: ["admin", "owner", "inspector"] },
];

const TASKS = [
  { id: "t1", icon: "❄️", name: "Зимен обход (стандартен)", mins: 40, items: 12 },
  { id: "t2", icon: "☀️", name: "Летен обход (стандартен)", mins: 55, items: 15 },
];

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
