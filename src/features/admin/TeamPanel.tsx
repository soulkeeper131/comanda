"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Icon } from "@/components/ui/Icon";
import { api } from "./api";
import { Chips, Field, inputClass } from "./ui";
import type { AdminUser } from "./types";

const ROLE: Record<AdminUser["role"], { text: string; tone: "accent" | "info" | "warning" }> = {
  admin: { text: "Админ", tone: "accent" },
  client: { text: "Клиент", tone: "info" },
  inspector: { text: "Инспектор", tone: "warning" },
};

/**
 * Екипът и клиентите. Админът създава акаунти на инспектори и админи
 * (въпрос 29); временната парола се показва веднъж — предава се лично.
 */
export default function TeamPanel({
  users,
  onChanged,
}: {
  users: AdminUser[];
  onChanged: (message: string, tone?: "ok" | "error") => void;
}) {
  const [filter, setFilter] = useState<"team" | "client" | "inactive">("team");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", role: "inspector" });
  const [created, setCreated] = useState<{ email: string; password?: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const list = users.filter((u) =>
    filter === "inactive" ? !u.active : u.active && (filter === "client" ? u.role === "client" : u.role !== "client"),
  );

  const patch = async (id: string, body: Record<string, unknown>, message: string) => {
    const res = await api("/api/users", { method: "PATCH", body: { id, ...body } });
    onChanged(res.ok ? message : res.error, res.ok ? "ok" : "error");
  };

  const create = async () => {
    setBusy(true);
    setError("");
    const res = await api<{ email: string; temporary_password?: string }>("/api/users", { body: form });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setCreated({ email: res.data.email, password: res.data.temporary_password });
    setForm({ full_name: "", email: "", phone: "", role: "inspector" });
    onChanged("Акаунтът е създаден");
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Chips
          value={filter}
          onChange={setFilter}
          options={[
            { value: "team", label: "Екип" },
            { value: "client", label: "Клиенти" },
            { value: "inactive", label: "Деактивирани" },
          ]}
        />
        <Button
          size="sm"
          className="mb-3 shrink-0"
          onClick={() => {
            setCreated(null);
            setError("");
            setCreating(true);
          }}
        >
          <Icon name="plus" size={16} /> Акаунт
        </Button>
      </div>
      <div className="space-y-2">
        {list.map((u) => (
          <Card key={u.id} padding="sm" className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-ink">{u.name || u.email}</div>
              <div className="truncate text-sm text-muted">
                {u.email}
                {u.phone ? ` · ${u.phone}` : ""}
              </div>
            </div>
            <select
              className={`${inputClass} w-auto min-w-[130px]`}
              value={u.role}
              aria-label="Роля"
              onChange={(e) => patch(u.id, { role: e.target.value }, "Ролята е сменена")}
            >
              <option value="client">Клиент</option>
              <option value="inspector">Инспектор</option>
              <option value="admin">Админ</option>
            </select>
            <Badge tone={ROLE[u.role].tone} className="hidden sm:inline-flex">
              {ROLE[u.role].text}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (u.active && !confirm(`Да деактивирам ли ${u.name || u.email}? Губи достъп веднага.`)) return;
                patch(u.id, { active: !u.active }, u.active ? "Деактивиран" : "Активиран");
              }}
            >
              {u.active ? "Деактивирай" : "Активирай"}
            </Button>
          </Card>
        ))}
      </div>

      <Sheet open={creating} onClose={() => setCreating(false)} placement="bottom" className="max-h-[90dvh] overflow-y-auto p-5">
        {created ? (
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-ink">Акаунтът е създаден</h3>
            <p className="text-sm text-muted">{created.email}</p>
            {created.password && (
              <div className="rounded-card bg-brand-bg p-3">
                <div className="text-sm text-muted">Временна парола — покажете я само на човека, показва се веднъж:</div>
                <div className="mt-1 select-all font-mono text-lg font-bold text-ink">{created.password}</div>
              </div>
            )}
            <Button fullWidth onClick={() => setCreating(false)}>
              Готово
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-ink">Нов акаунт</h3>
            <Field label="Име">
              <input className={inputClass} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </Field>
            <Field label="Имейл">
              <input className={inputClass} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Телефон">
              <input className={inputClass} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Роля">
              <select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="inspector">Инспектор</option>
                <option value="admin">Админ</option>
                <option value="client">Клиент</option>
              </select>
            </Field>
            {error && <p className="rounded-card bg-state-danger/10 px-3 py-2 text-sm text-state-danger">{error}</p>}
            <div className="flex gap-2 pb-2">
              <Button variant="secondary" fullWidth onClick={() => setCreating(false)}>
                Отказ
              </Button>
              <Button fullWidth disabled={busy || !form.email || !form.full_name} onClick={create}>
                Създай
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
