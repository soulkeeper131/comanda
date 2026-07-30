"use client";

import { useState, useEffect, useCallback } from "react";

type TemplateItem = {
  id: string;
  template_id: string;
  zone_label: string | null;
  label: string;
  proof_type: string;
  required: boolean;
  sort: number;
};

type Template = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  icon: string;
  duration_min: number;
  items?: TemplateItem[];
};

const PROOF_LABELS: Record<string, string> = {
  photo: "📷 Снимка",
  note: "📝 Бележка",
  none: "— Без",
};

export default function TemplateManager() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemsMap, setItemsMap] = useState<Record<string, TemplateItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  // Add item form state
  const [addingForId, setAddingForId] = useState<string | null>(null);
  const [newZone, setNewZone] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newProofType, setNewProofType] = useState("photo");
  const [newRequired, setNewRequired] = useState(true);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editProofType, setEditProofType] = useState("photo");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  };

  // Load templates
  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
        // Seed itemsMap from embedded items
        const seed: Record<string, TemplateItem[]> = {};
        for (const tpl of data) {
          if (tpl.items?.length) {
            seed[tpl.id] = tpl.items;
          }
        }
        setItemsMap((prev) => ({ ...seed, ...prev }));
      }
    } catch (e) {
      console.error("Load templates error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Load items for a template
  const loadItems = async (templateId: string) => {
    if (itemsMap[templateId]) return; // already loaded
    try {
      const res = await fetch(`/api/template-items?template_id=${templateId}`);
      if (res.ok) {
        const data = await res.json();
        setItemsMap((prev) => ({ ...prev, [templateId]: data }));
      }
    } catch (e) {
      console.error("Load items error:", e);
    }
  };

  const handleExpand = (templateId: string) => {
    if (expandedId === templateId) {
      setExpandedId(null);
      setAddingForId(null);
      setEditingId(null);
    } else {
      setExpandedId(templateId);
      setAddingForId(null);
      setEditingId(null);
      loadItems(templateId);
    }
  };

  // Add item
  const handleAddItem = async (templateId: string) => {
    if (!newLabel.trim()) {
      showToast("❌ Въведете име на стъпката");
      return;
    }
    try {
      const res = await fetch("/api/template-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: templateId,
          zone_label: newZone.trim() || null,
          label: newLabel.trim(),
          proof_type: newProofType,
          required: newRequired,
          sort: (itemsMap[templateId]?.length || 0),
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setItemsMap((prev) => ({
          ...prev,
          [templateId]: [...(prev[templateId] || []), created],
        }));
        setNewZone("");
        setNewLabel("");
        setNewProofType("photo");
        setNewRequired(true);
        setAddingForId(null);
        showToast("✅ Стъпката е добавена");
      } else {
        showToast("❌ Грешка при добавяне");
      }
    } catch {
      showToast("❌ Грешка при добавяне");
    }
  };

  // Delete item
  const handleDeleteItem = async (itemId: string, templateId: string) => {
    if (!confirm("Сигурни ли сте, че искате да изтриете тази стъпка?")) return;
    try {
      const res = await fetch(`/api/template-items/${itemId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setItemsMap((prev) => ({
          ...prev,
          [templateId]: (prev[templateId] || []).filter((it) => it.id !== itemId),
        }));
        showToast("✅ Стъпката е изтрита");
      } else {
        showToast("❌ Грешка при изтриване");
      }
    } catch {
      showToast("❌ Грешка при изтриване");
    }
  };

  // Start edit
  const handleStartEdit = (item: TemplateItem) => {
    setEditingId(item.id);
    setEditLabel(item.label);
    setEditProofType(item.proof_type);
  };

  // Save edit
  const handleSaveEdit = async (itemId: string, templateId: string) => {
    if (!editLabel.trim()) {
      showToast("❌ Въведете име на стъпката");
      return;
    }
    try {
      const res = await fetch(`/api/template-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: editLabel.trim(),
          proof_type: editProofType,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setItemsMap((prev) => ({
          ...prev,
          [templateId]: (prev[templateId] || []).map((it) =>
            it.id === itemId ? updated : it
          ),
        }));
        setEditingId(null);
        showToast("✅ Стъпката е обновена");
      } else {
        showToast("❌ Грешка при обновяване");
      }
    } catch {
      showToast("❌ Грешка при обновяване");
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLabel("");
    setEditProofType("photo");
  };

  // Group items by zone_label
  const groupByZone = (items: TemplateItem[]) => {
    const groups: Record<string, TemplateItem[]> = {};
    for (const item of items) {
      const zone = item.zone_label || "Без зона";
      if (!groups[zone]) groups[zone] = [];
      groups[zone].push(item);
    }
    return groups;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: "#247ba0" }}>
        Зареждане...
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 relative">
      <h3 className="text-lg font-bold mb-4" style={{ color: "#006494" }}>
        📋 Шаблони
      </h3>

      {templates.length === 0 && (
        <div className="text-center py-12" style={{ color: "#247ba0" }}>
          <div className="text-4xl mb-3">📋</div>
          <div className="text-sm">Няма създадени шаблони</div>
        </div>
      )}

      <div className="space-y-3">
        {templates.map((tpl) => {
          const isExpanded = expandedId === tpl.id;
          const items = itemsMap[tpl.id] || [];
          const zoneGroups = groupByZone(items);

          return (
            <div
              key={tpl.id}
              className="rounded-xl border bg-white overflow-hidden"
              style={{ borderColor: "#e4e9f0" }}
            >
              {/* Template header */}
              <button
                onClick={() => handleExpand(tpl.id)}
                className="w-full flex items-center gap-3 p-4 text-left transition"
              >
                <span className="text-xl">{tpl.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold" style={{ color: "#006494" }}>
                    {tpl.name}
                  </div>
                  <div className="text-xs" style={{ color: "#247ba0" }}>
                    {tpl.category} · {tpl.duration_min} мин
                  </div>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: "#e8f1f2", color: "#247ba0" }}
                >
                  {items.length} стъпки
                </span>
                <span
                  className="text-lg transition-transform flex-shrink-0"
                  style={{
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    color: "#247ba0",
                  }}
                >
                  ▾
                </span>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t" style={{ borderColor: "#e4e9f0" }}>
                  {/* Zone groups */}
                  {Object.keys(zoneGroups).length === 0 && (
                    <div className="text-xs py-4 text-center" style={{ color: "#247ba0" }}>
                      Няма стъпки в този шаблон
                    </div>
                  )}

                  {Object.entries(zoneGroups).map(([zone, zoneItems]) => (
                    <div key={zone} className="mt-3">
                      <div
                        className="text-xs font-bold px-2 py-1 rounded-md mb-2 inline-block"
                        style={{ background: "#e8f1f2", color: "#006494" }}
                      >
                        📍 {zone}
                      </div>
                      <div className="space-y-1">
                        {zoneItems.map((item) => (
                          <div key={item.id}>
                            {editingId === item.id ? (
                              /* Edit mode */
                              <div
                                className="flex flex-col gap-2 p-3 rounded-lg border"
                                style={{ borderColor: "#d0e5ff", background: "#f0f8ff" }}
                              >
                                <input
                                  type="text"
                                  value={editLabel}
                                  onChange={(e) => setEditLabel(e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg border text-sm"
                                  style={{
                                    fontSize: 16,
                                    borderColor: "#e4e9f0",
                                    color: "#006494",
                                  }}
                                  placeholder="Име на стъпката"
                                />
                                <select
                                  value={editProofType}
                                  onChange={(e) => setEditProofType(e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg border text-sm"
                                  style={{
                                    fontSize: 16,
                                    borderColor: "#e4e9f0",
                                    color: "#006494",
                                  }}
                                >
                                  <option value="photo">📷 Снимка</option>
                                  <option value="note">📝 Бележка</option>
                                  <option value="none">— Без доказателство</option>
                                </select>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleSaveEdit(item.id, tpl.id)}
                                    className="flex-1 min-h-[44px] py-2 rounded-lg text-xs font-semibold text-white"
                                    style={{
                                      background: "linear-gradient(140deg, #1b98e0, #006494)",
                                    }}
                                  >
                                    💾 Запази
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    className="flex-1 min-h-[44px] py-2 rounded-lg text-xs font-semibold border"
                                    style={{ borderColor: "#e4e9f0", color: "#247ba0" }}
                                  >
                                    Отказ
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* Display mode */
                              <div
                                className="flex items-center gap-2 p-2 rounded-lg group hover:bg-gray-50 transition"
                              >
                                {/* Drag hint */}
                                <span className="text-xs flex-shrink-0" style={{ color: "#ccc" }}>
                                  ⠿
                                </span>
                                {/* Label */}
                                <span
                                  className="text-sm flex-1 min-w-0"
                                  style={{ fontSize: 16, color: "#006494" }}
                                >
                                  {item.label}
                                </span>
                                {/* Proof type */}
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                                  style={{
                                    background:
                                      item.proof_type === "photo"
                                        ? "#dbeafe"
                                        : item.proof_type === "note"
                                        ? "#fef3c7"
                                        : "#f3f4f6",
                                    color:
                                      item.proof_type === "photo"
                                        ? "#1b98e0"
                                        : item.proof_type === "note"
                                        ? "#d97706"
                                        : "#9ca3af",
                                    fontSize: 12,
                                  }}
                                >
                                  {PROOF_LABELS[item.proof_type] || item.proof_type}
                                </span>
                                {/* Required badge */}
                                {item.required && (
                                  <span
                                    className="text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                                    style={{ background: "#dcfce7", color: "#16a34a", fontSize: 11 }}
                                  >
                                    зад.
                                  </span>
                                )}
                                {/* Actions */}
                                <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition">
                                  <button
                                    onClick={() => handleStartEdit(item)}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm hover:bg-gray-100 transition"
                                    title="Редактирай"
                                    style={{ fontSize: 16 }}
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => handleDeleteItem(item.id, tpl.id)}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm hover:bg-red-50 transition"
                                    title="Изтрий"
                                    style={{ fontSize: 16 }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Add item form or button */}
                  {addingForId === tpl.id ? (
                    <div
                      className="mt-4 p-3 rounded-lg border"
                      style={{ borderColor: "#d0e5ff", background: "#f0f8ff" }}
                    >
                      <div className="text-xs font-bold mb-2" style={{ color: "#006494" }}>
                        Нова стъпка
                      </div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={newZone}
                          onChange={(e) => setNewZone(e.target.value)}
                          placeholder="Зона (напр. Баня, Кухня)"
                          className="w-full px-3 py-2 rounded-lg border text-sm"
                          style={{ fontSize: 16, borderColor: "#e4e9f0", color: "#006494" }}
                        />
                        <input
                          type="text"
                          value={newLabel}
                          onChange={(e) => setNewLabel(e.target.value)}
                          placeholder="Име на стъпката"
                          className="w-full px-3 py-2 rounded-lg border text-sm"
                          style={{ fontSize: 16, borderColor: "#e4e9f0", color: "#006494" }}
                        />
                        <div className="flex gap-2">
                          <select
                            value={newProofType}
                            onChange={(e) => setNewProofType(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-lg border text-sm"
                            style={{ fontSize: 16, borderColor: "#e4e9f0", color: "#006494" }}
                          >
                            <option value="photo">📷 Снимка</option>
                            <option value="note">📝 Бележка</option>
                            <option value="none">— Без доказателство</option>
                          </select>
                          <label
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border cursor-pointer"
                            style={{ borderColor: "#e4e9f0", fontSize: 14, color: "#006494" }}
                          >
                            <input
                              type="checkbox"
                              checked={newRequired}
                              onChange={(e) => setNewRequired(e.target.checked)}
                              className="w-4 h-4"
                            />
                            Задължителна
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAddItem(tpl.id)}
                            className="flex-1 min-h-[44px] py-2 rounded-lg text-xs font-semibold text-white"
                            style={{ background: "linear-gradient(140deg, #1b98e0, #006494)" }}
                          >
                            ✅ Добави
                          </button>
                          <button
                            onClick={() => {
                              setAddingForId(null);
                              setNewZone("");
                              setNewLabel("");
                              setNewProofType("photo");
                              setNewRequired(true);
                            }}
                            className="flex-1 min-h-[44px] py-2 rounded-lg text-xs font-semibold border"
                            style={{ borderColor: "#e4e9f0", color: "#247ba0" }}
                          >
                            Отказ
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingForId(tpl.id)}
                      className="w-full mt-3 min-h-[44px] py-2 rounded-lg text-xs font-semibold border border-dashed transition hover:bg-gray-50"
                      style={{ borderColor: "#247ba0", color: "#247ba0" }}
                    >
                      ➕ Добави стъпка
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-[max(96px,calc(96px+env(safe-area-inset-bottom)))] left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full text-white text-sm font-semibold shadow-lg"
          style={{ background: "#006494" }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
