"use client";

import { useState, useEffect } from "react";

interface SmtpFormData {
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_from: string;
  notify_email: string;
}

export default function SmtpSettings() {
  const [form, setForm] = useState<SmtpFormData>({
    smtp_host: "",
    smtp_port: "587",
    smtp_user: "",
    smtp_pass: "",
    smtp_from: "",
    notify_email: "",
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/smtp")
      .then((r) => r.json())
      .then((data) => {
        if (data.smtp) {
          setForm({
            smtp_host: data.smtp.smtp_host || "",
            smtp_port: String(data.smtp.smtp_port || "587"),
            smtp_user: data.smtp.smtp_user || "",
            smtp_pass: "",
            smtp_from: data.smtp.smtp_from || "",
            notify_email: data.smtp.notify_email || "",
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const showMsg = (text: string, ok: boolean) => {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSave = async () => {
    if (!form.smtp_host.trim()) {
      showMsg("❌ SMTP Host е задължителен", false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtp_host: form.smtp_host.trim(),
          smtp_port: parseInt(form.smtp_port, 10) || 587,
          smtp_user: form.smtp_user.trim(),
          smtp_pass: form.smtp_pass,
          smtp_from: form.smtp_from.trim() || form.smtp_user.trim(),
          notify_email: form.notify_email.trim() || form.smtp_user.trim(),
        }),
      });
      if (res.ok) {
        showMsg("✅ Настройките са запазени", true);
        // Clear password field for security
        setForm((prev) => ({ ...prev, smtp_pass: "" }));
      } else {
        const err = await res.json().catch(() => ({}));
        showMsg("❌ " + (err.error || "Грешка при запис"), false);
      }
    } catch {
      showMsg("❌ Грешка при запис", false);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/admin/smtp/test", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showMsg("✅ Тестовият имейл е изпратен! Проверете входящата си поща.", true);
      } else {
        showMsg("❌ " + (data.error || "Грешка при тест"), false);
      }
    } catch {
      showMsg("❌ Грешка при тест", false);
    } finally {
      setTesting(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2.5 rounded-lg border text-sm";
  const inputStyle: React.CSSProperties = {
    fontSize: 16,
    borderColor: "#e4e9f0",
    color: "#006494",
  };
  const labelStyle: React.CSSProperties = {
    color: "#247ba0",
    fontSize: 13,
    fontWeight: 600,
  };

  if (loading) {
    return (
      <div className="text-center py-12" style={{ color: "#247ba0" }}>
        Зареждане...
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold mb-1" style={{ color: "#006494" }}>
            📧 Настройки за имейл
          </h2>
          <p className="text-xs" style={{ color: "#247ba0" }}>
            Конфигурирайте SMTP сървър за изпращане на имейл известия.
          </p>
        </div>

        {/* SMTP Host */}
        <div>
          <label style={labelStyle}>SMTP Host *</label>
          <input
            type="text"
            value={form.smtp_host}
            onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
            placeholder="smtp.gmail.com"
            className={inputClass}
            style={inputStyle}
          />
        </div>

        {/* SMTP Port */}
        <div>
          <label style={labelStyle}>SMTP Port</label>
          <input
            type="number"
            value={form.smtp_port}
            onChange={(e) => setForm({ ...form, smtp_port: e.target.value })}
            placeholder="587"
            className={inputClass}
            style={inputStyle}
          />
        </div>

        {/* SMTP User */}
        <div>
          <label style={labelStyle}>SMTP Username</label>
          <input
            type="text"
            value={form.smtp_user}
            onChange={(e) => setForm({ ...form, smtp_user: e.target.value })}
            placeholder="user@gmail.com"
            className={inputClass}
            style={inputStyle}
          />
        </div>

        {/* SMTP Password */}
        <div>
          <label style={labelStyle}>SMTP Password</label>
          <input
            type="password"
            value={form.smtp_pass}
            onChange={(e) => setForm({ ...form, smtp_pass: e.target.value })}
            placeholder="Оставете празно за да не променяте"
            className={inputClass}
            style={inputStyle}
          />
        </div>

        {/* From Email */}
        <div>
          <label style={labelStyle}>From Email</label>
          <input
            type="email"
            value={form.smtp_from}
            onChange={(e) => setForm({ ...form, smtp_from: e.target.value })}
            placeholder="no-reply@comanda.bg"
            className={inputClass}
            style={inputStyle}
          />
        </div>

        {/* Admin/Notify Email */}
        <div>
          <label style={labelStyle}>Имейл за известия (admin)</label>
          <input
            type="email"
            value={form.notify_email}
            onChange={(e) => setForm({ ...form, notify_email: e.target.value })}
            placeholder="admin@comanda.bg"
            className={inputClass}
            style={inputStyle}
          />
        </div>

        {/* Message */}
        {message && (
          <div
            className={`px-4 py-3 rounded-lg text-sm font-semibold ${
              message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 min-h-[44px] py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{
              background: "linear-gradient(140deg, #1b98e0, #006494)",
            }}
          >
            {saving ? "⏳ Записване..." : "💾 Запази"}
          </button>
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex-1 min-h-[44px] py-2.5 rounded-lg text-sm font-semibold border disabled:opacity-50"
            style={{
              borderColor: "#a663cc",
              color: "#a663cc",
              background: "#faf5ff",
            }}
          >
            {testing ? "⏳ Изпращане..." : "🧪 Тест"}
          </button>
        </div>
      </div>
    </div>
  );
}
