"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

type Smtp = { smtp_host: string; smtp_port: string; smtp_user: string; smtp_from: string; notify_email: string };

const input =
  "w-full min-h-touch rounded-card border border-line bg-white px-3 text-field text-ink focus:border-brand-primary focus:outline-none disabled:bg-brand-bg disabled:text-muted";

const FIELDS: [keyof Smtp | "smtp_pass", string, string, string][] = [
  ["smtp_host", "Сървър (SMTP host)", "text", "smtp.gmail.com"],
  ["smtp_port", "Порт", "text", "587"],
  ["smtp_user", "Потребител", "text", "office@comanda.bg"],
  ["smtp_pass", "Парола", "password", "••••••••"],
  ["smtp_from", "Подател (From)", "text", "Ко Манда <office@comanda.bg>"],
  ["notify_email", "Адрес за известия на екипа", "text", "office@comanda.bg"],
];

/**
 * Имейл сървърът. Ако е настроен в Coolify (SMTP_*), той важи и тук само се
 * вижда. Бутонът „Тест" чака истинския отговор на сървъра.
 */
export default function SmtpSettings() {
  const [source, setSource] = useState<"env" | "db" | null>(null);
  const [form, setForm] = useState<Smtp & { smtp_pass: string }>({
    smtp_host: "",
    smtp_port: "587",
    smtp_user: "",
    smtp_pass: "",
    smtp_from: "",
    notify_email: "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/smtp")
      .then((r) => r.json())
      .then((d) => {
        setSource(d.source ?? null);
        if (d.smtp) setForm((f) => ({ ...f, ...d.smtp, smtp_port: String(d.smtp.smtp_port || "587"), smtp_pass: "" }));
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/smtp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (res?.ok) setSource("db");
    setMsg(res?.ok ? { text: "Запазено", ok: true } : { text: d.error || "Грешка при запис", ok: false });
  };

  const test = async () => {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/email/test", { method: "POST" }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    setMsg(res?.ok ? { text: `Пробният имейл е изпратен до ${d.to}`, ok: true } : { text: d.error || "Няма връзка", ok: false });
  };

  if (loading) return <p className="p-4 text-sm text-muted">Зареждане…</p>;
  const fromEnv = source === "env";

  return (
    <div className="space-y-3 p-4">
      <div
        className={`flex items-center gap-2 rounded-card px-3 py-2 text-sm font-semibold ${
          source ? "bg-state-ok/10 text-state-ok" : "bg-state-warning/10 text-state-warning"
        }`}
      >
        <Icon name={source ? "check-circle" : "alert"} size={16} />
        {fromEnv ? "Настроен в Coolify — промените се правят там" : source ? "Настроен от тук" : "Не е настроен — имейли не се пращат"}
      </div>
      {FIELDS.map(([key, label, type, placeholder]) =>
        fromEnv && key === "smtp_pass" ? null : (
          <label key={key} className="block">
            <span className="mb-1 block text-sm font-semibold text-ink-2">{label}</span>
            <input
              type={type}
              className={input}
              placeholder={placeholder}
              disabled={fromEnv}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </label>
        ),
      )}
      {msg && (
        <p className={`rounded-card px-3 py-2 text-sm ${msg.ok ? "bg-state-ok/10 text-state-ok" : "bg-state-danger/10 text-state-danger"}`}>
          {msg.text}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {!fromEnv && (
          <Button disabled={busy || !form.smtp_host} onClick={save}>
            Запази
          </Button>
        )}
        <Button variant="secondary" disabled={busy || !source} onClick={test}>
          <Icon name="mail" size={16} /> Изпрати пробен имейл
        </Button>
      </div>
    </div>
  );
}
