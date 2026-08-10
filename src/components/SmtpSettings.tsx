"use client";

import { useState, useEffect } from "react";

interface SmtpFormData {
  smtp_host: string; smtp_port: string; smtp_user: string;
  smtp_pass: string; smtp_from: string; notify_email: string;
}

type TemplateKey = "welcome" | "job_assigned" | "job_completed" | "finding_new" | "offer_new" | "offer_decided" | "inquiry_new";

const TEMPLATE_META: Record<string, { label: string; vars: string }> = {
  welcome: { label: "🎉 Регистрация", vars: "{{name}}" },
  job_assigned: { label: "📋 Възложен обход", vars: "{{property}}, {{date}}, {{worker}}" },
  job_completed: { label: "✅ Завършен обход", vars: "{{property}}, {{worker}}, {{duration}}" },
  finding_new: { label: "⚠️ Нова констатация", vars: "{{property}}, {{title}}, {{body}}" },
  offer_new: { label: "💰 Нова оферта", vars: "{{property}}, {{price}}, {{days}}, {{scope}}" },
  offer_decided: { label: "✅ Приета/отказана оферта", vars: "{{property}}, {{price}}, {{decision}}, {{decision_lower}}" },
  inquiry_new: { label: "📩 Ново запитване", vars: "{{name}}, {{email}}, {{phone}}, {{message}}" },
};

export default function SmtpSettings() {
  const [tab, setTab] = useState<"smtp" | "templates">("smtp");
  const [configured, setConfigured] = useState(false);
  const [form, setForm] = useState<SmtpFormData>({
    smtp_host: "", smtp_port: "587", smtp_user: "", smtp_pass: "", smtp_from: "", notify_email: "",
  });
  const [templates, setTemplates] = useState<Record<string, { subject: string; html: string }>>({});
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editHtml, setEditHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/smtp")
      .then((r) => r.json())
      .then((data) => {
        setConfigured(!!data.configured);
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
        if (data.templates) setTemplates(data.templates);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const showMsg = (text: string, ok: boolean) => {
    setMessage({ text, ok });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSaveSmtp = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setConfigured(true);
        showMsg("✅ Запазено", true);
      } else {
        showMsg("❌ Грешка", false);
      }
    } catch { showMsg("❌ Грешка", false); }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/email/test", { method: "POST" });
      showMsg(res.ok ? "✅ Тестовият мейл е изпратен" : "❌ Грешка при изпращане", res.ok);
    } catch { showMsg("❌ Грешка", false); }
    setTesting(false);
  };

  const openTemplateEditor = (key: string) => {
    setEditKey(key);
    setEditSubject(templates[key]?.subject || "");
    setEditHtml(templates[key]?.html || "");
  };

  const handleSaveTemplate = async () => {
    if (!editKey) return;
    setSaving(true);
    const updated = { ...templates, [editKey]: { subject: editSubject, html: editHtml } };
    try {
      const res = await fetch("/api/admin/smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, email_templates: updated }),
      });
      if (res.ok) {
        setTemplates(updated);
        setEditKey(null);
        showMsg("✅ Шаблонът е запазен", true);
      } else {
        showMsg("❌ Грешка", false);
      }
    } catch { showMsg("❌ Грешка", false); }
    setSaving(false);
  };

  if (loading) return <div className="p-6 text-sm" style={{ color: "#247ba0" }}>Зареждане...</div>;

  const inputClass = "w-full min-h-[44px] md:min-h-0 md:h-10 px-3 rounded-lg border text-sm";
  const labelClass = "text-xs font-semibold mb-1 block";
  const btnClass = "min-h-[44px] md:min-h-0 md:h-10 px-5 rounded-xl text-sm font-bold text-white transition";
  const btnPrimary = { background: "linear-gradient(140deg, #1b98e0, #006494)" };
  const btnSecondary = { background: "#a663cc" };

  return (
    <div className="p-4 md:p-6">
      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-white rounded-xl p-1 border" style={{ borderColor: "#e4e9f0" }}>
        {(["smtp", "templates"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition"
            style={{
              background: tab === t ? "#1b98e0" : "transparent",
              color: tab === t ? "#fff" : "#247ba0",
            }}
          >
            {t === "smtp" ? "📧 SMTP" : "📝 Шаблони"}
          </button>
        ))}
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
          {message.text}
        </div>
      )}

      {/* SMTP Tab */}
      {tab === "smtp" && (
        <div className="bg-white rounded-2xl border p-5 space-y-4" style={{ borderColor: "#e4e9f0" }}>
          {/* Status indicator */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
            configured ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full ${configured ? "bg-green-500" : "bg-yellow-500"}`} />
            {configured ? "✅ SMTP е конфигуриран" : "⚠️ SMTP не е конфигуриран"}
          </div>
          {[
            ["SMTP Host", "smtp_host", "text", "smtp.gmail.com"],
            ["Port", "smtp_port", "text", "587"],
            ["Username", "smtp_user", "text", "user@gmail.com"],
            ["Password", "smtp_pass", "password", "••••••••"],
            ["From Email", "smtp_from", "text", "noreply@example.com"],
            ["Admin Email", "notify_email", "text", "admin@example.com"],
          ].map(([label, key, type, placeholder]) => (
            <div key={key}>
              <label className={labelClass} style={{ color: "#247ba0" }}>{label}</label>
              <input
                type={type as string}
                className={inputClass}
                style={{ borderColor: "#e4e9f0" }}
                placeholder={placeholder as string}
                value={(form as any)[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button onClick={handleSaveSmtp} disabled={saving} className={btnClass} style={btnPrimary}>
              {saving ? "Запазване..." : "💾 Запази"}
            </button>
            <button onClick={handleTest} disabled={testing} className={btnClass} style={btnSecondary}>
              {testing ? "Изпращане..." : "📤 Тест"}
            </button>
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {tab === "templates" && (
        <div className="space-y-2">
          {editKey ? (
            /* Template Editor */
            <div className="bg-white rounded-2xl border p-5 space-y-4" style={{ borderColor: "#e4e9f0" }}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold" style={{ color: "#006494" }}>
                  ✏️ {TEMPLATE_META[editKey]?.label || editKey}
                </h3>
                <button onClick={() => setEditKey(null)} className="text-sm" style={{ color: "#a663cc" }}>
                  ← Назад
                </button>
              </div>
              <div className="text-xs mb-2" style={{ color: "#64748b" }}>
                Променливи: <code className="bg-gray-100 px-1.5 py-0.5 rounded">{TEMPLATE_META[editKey]?.vars}</code>
              </div>
              <div>
                <label className={labelClass} style={{ color: "#247ba0" }}>Тема (subject)</label>
                <input className={inputClass} style={{ borderColor: "#e4e9f0" }}
                  value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "#247ba0" }}>HTML съдържание</label>
                <textarea
                  className={inputClass}
                  style={{ borderColor: "#e4e9f0", minHeight: 280, fontFamily: "monospace", fontSize: 12 }}
                  value={editHtml}
                  onChange={(e) => setEditHtml(e.target.value)}
                />
              </div>
              <button onClick={handleSaveTemplate} disabled={saving} className={btnClass + " w-full"} style={btnPrimary}>
                {saving ? "Запазване..." : "💾 Запази шаблона"}
              </button>
            </div>
          ) : (
            /* Template List */
            <div className="bg-white rounded-2xl border divide-y" style={{ borderColor: "#e4e9f0", borderBottom: "none" }}>
              {Object.entries(TEMPLATE_META).map(([key, meta]) => (
                <div
                  key={key}
                  onClick={() => openTemplateEditor(key)}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition"
                >
                  <div>
                    <div className="font-semibold text-sm" style={{ color: "#006494" }}>{meta.label}</div>
                    <div className="text-xs mt-0.5 truncate max-w-[280px]" style={{ color: "#64748b" }}>
                      {templates[key]?.subject || "(по подразбиране)"}
                    </div>
                  </div>
                  <span style={{ color: "#a663cc" }}>→</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
