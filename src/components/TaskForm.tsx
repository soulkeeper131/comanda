"use client";

import { useState, useEffect } from "react";
import { Sheet } from "./ui/Sheet";
import { Button } from "./ui/Button";
import { Select, Input } from "./ui/Input";

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
    <Sheet open onClose={onClose} placement="center">
      <h3 className="text-lg font-bold mb-4 text-brand-dark">➕ Нова задача</h3>
      {loading ? (
        <div className="text-center py-8 text-brand-secondary">Зареждане...</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <Select value={propertyId} onChange={e => setPropertyId(e.target.value)} required className="text-brand-dark">
            <option value="">🏠 Избери имот</option>
            {properties.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name} — {p.address?.split(",")[0]}</option>
            ))}
          </Select>

          <Select value={templateId} onChange={e => setTemplateId(e.target.value)} required className="text-brand-dark">
            <option value="">📋 Избери шаблон</option>
            {templates.map((t: any) => (
              <option key={t.id} value={t.id}>{t.icon} {t.name} ({t.duration_min} мин)</option>
            ))}
          </Select>

          <Select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className="text-brand-dark">
            <option value="">👷 Избери работник (по избор)</option>
            {users.map((u: any) => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </Select>

          <Input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Заглавие (по избор)" />

          <Input type="datetime-local" value={plannedAt} onChange={e => setPlannedAt(e.target.value)} required className="text-brand-dark" />

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" fullWidth onClick={onClose}>Отказ</Button>
            <Button type="submit" variant="primary" fullWidth>Възложи</Button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
