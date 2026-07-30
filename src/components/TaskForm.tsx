"use client";

import { useState, useEffect } from "react";

type Props = {
  onSave: (data: { propertyId: string; templateId: string; assigneeId: string; title: string; plannedAt: string }) => void;
  onClose: () => void;
};

export default function TaskForm({ onSave, onClose }: Props) {
  const [properties, setProperties] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [propertyId, setPropertyId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [title, setTitle] = useState("");
  const [plannedAt, setPlannedAt] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/properties").then(r => r.json()),
      fetch("/api/templates").then(r => r.json()),
      fetch("/api/users").then(r => r.json()),
    ]).then(([p, t, u]) => {
      setProperties(Array.isArray(p) ? p : []);
      setTemplates(Array.isArray(t) ? t : []);
      setUsers((u.users || []).filter((x: any) => x.active));
      setLoading(false);
    });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId || !templateId) return;
    onSave({
      propertyId,
      templateId,
      assigneeId: assigneeId || "",
      title: title || templates.find(t => t.id === templateId)?.name || "Обход",
      plannedAt: new Date(plannedAt).toISOString(),
    });
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-x-4 bottom-1/2 translate-y-1/2 z-50 max-w-md mx-auto bg-white rounded-2xl shadow-2xl p-6">
        <h3 className="text-lg font-bold mb-4" style={{ color: "#006494" }}>➕ Нова задача</h3>
        {loading ? (
          <div className="text-center py-8" style={{ color: "#247ba0" }}>Зареждане...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <select value={propertyId} onChange={e => setPropertyId(e.target.value)} required
              className="w-full px-4 py-3 rounded-xl border text-base"
              style={{ borderColor: "#e4e9f0", fontSize: 16, color: "#006494" }}>
              <option value="">🏠 Избери имот</option>
              {properties.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name} — {p.address?.split(",")[0]}</option>
              ))}
            </select>

            <select value={templateId} onChange={e => setTemplateId(e.target.value)} required
              className="w-full px-4 py-3 rounded-xl border text-base"
              style={{ borderColor: "#e4e9f0", fontSize: 16, color: "#006494" }}>
              <option value="">📋 Избери шаблон</option>
              {templates.map((t: any) => (
                <option key={t.id} value={t.id}>{t.icon} {t.name} ({t.duration_min} мин)</option>
              ))}
            </select>

            <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border text-base"
              style={{ borderColor: "#e4e9f0", fontSize: 16, color: "#006494" }}>
              <option value="">👷 Избери работник (по избор)</option>
              {users.map((u: any) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>

            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Заглавие (по избор)"
              className="w-full px-4 py-3 rounded-xl border text-base"
              style={{ borderColor: "#e4e9f0", fontSize: 16 }} />

            <input type="datetime-local" value={plannedAt} onChange={e => setPlannedAt(e.target.value)} required
              className="w-full px-4 py-3 rounded-xl border text-base"
              style={{ borderColor: "#e4e9f0", fontSize: 16, color: "#006494" }} />

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 min-h-[44px] py-3 rounded-xl text-sm font-semibold border"
                style={{ borderColor: "#d0e5ff", color: "#247ba0" }}>Отказ</button>
              <button type="submit"
                className="flex-1 min-h-[44px] py-3 rounded-xl text-sm font-semibold text-white"
                style={{ background: "linear-gradient(140deg, #1b98e0, #006494)" }}>Възложи</button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
