"use client";

import { useEffect, useState } from "react";
import { Sheet } from "./ui/Sheet";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Icon } from "./ui/Icon";
import PushBell from "./PushBell";
import { formatDateOnly, formatMoney } from "@/lib/format";

type Me = {
  name: string;
  email: string;
  role: string;
  phone: string | null;
  company_name: string | null;
  eik: string | null;
  vat_number: string | null;
};
type Payment = { id: string; amount: number; status: string; method: string; created_at: string | null; paid_at: string | null };
type Invoice = { id: string; number: string; amount: number | null; description: string | null; created_at: string | null };

const input =
  "w-full min-h-touch rounded-card border border-line bg-white px-3 text-field text-ink focus:border-brand-primary focus:outline-none";

const PAYMENT_STATUS: Record<string, { text: string; tone: "ok" | "warning" | "danger" | "neutral" }> = {
  paid: { text: "Платено", tone: "ok" },
  pending: { text: "Чака потвърждение", tone: "warning" },
  failed: { text: "Неуспешно", tone: "danger" },
  cancelled: { text: "Отказано", tone: "neutral" },
};

/** Профил: собствени данни, парола, а за клиента — плащания и фактури. */
export default function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [me, setMe] = useState<Me | null>(null);
  const [form, setForm] = useState({ full_name: "", phone: "", company_name: "", eik: "", vat_number: "" });
  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMsg(null);
    setPw({ current_password: "", new_password: "" });
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Me | null) => {
        if (!d) return;
        setMe(d);
        setForm({
          full_name: d.name ?? "",
          phone: d.phone ?? "",
          company_name: d.company_name ?? "",
          eik: d.eik ?? "",
          vat_number: d.vat_number ?? "",
        });
        if (d.role === "client") {
          fetch("/api/payments").then((r) => (r.ok ? r.json() : [])).then(setPayments).catch(() => {});
          fetch("/api/invoices").then((r) => (r.ok ? r.json() : [])).then(setInvoices).catch(() => {});
        }
      })
      .catch(() => {});
  }, [open]);

  const save = async (body: Record<string, string>, okText: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      setMsg(res.ok ? { text: okText, ok: true } : { text: d.error || "Грешка", ok: false });
      if (res.ok) setPw({ current_password: "", new_password: "" });
    } catch {
      setMsg({ text: "Няма връзка със сървъра", ok: false });
    } finally {
      setBusy(false);
    }
  };

  const isClient = me?.role === "client";

  return (
    <Sheet open={open} onClose={onClose} placement="bottom" className="max-h-[92dvh] overflow-y-auto p-5">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-ink">Профил</h3>
            <p className="text-sm text-muted">{me?.email}</p>
          </div>
          <button onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-brand-bg" aria-label="Затвори">
            <Icon name="x" />
          </button>
        </div>

        <div className="space-y-2">
          <input className={input} placeholder="Име" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <input className={input} type="tel" placeholder="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          {isClient && (
            <>
              <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted">Данни за фактура (по желание)</p>
              <input className={input} placeholder="Фирма" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <input className={input} placeholder="ЕИК" value={form.eik} onChange={(e) => setForm({ ...form, eik: e.target.value })} />
                <input className={input} placeholder="ДДС №" value={form.vat_number} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} />
              </div>
            </>
          )}
          <Button fullWidth disabled={busy || !form.full_name.trim()} onClick={() => save(form, "Данните са запазени")}>
            Запази
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
          <div>
            <p className="text-sm font-semibold text-ink-2">Известия на това устройство</p>
            <p className="text-xs text-muted">Спешни проблеми, нови обходи и оферти — дори при затворено приложение.</p>
          </div>
          <PushBell />
        </div>

        <div className="space-y-2 border-t border-line pt-4">
          <p className="text-sm font-semibold text-ink-2">Смяна на парола</p>
          <input
            className={input}
            type="password"
            autoComplete="current-password"
            placeholder="Текуща парола"
            value={pw.current_password}
            onChange={(e) => setPw({ ...pw, current_password: e.target.value })}
          />
          <input
            className={input}
            type="password"
            autoComplete="new-password"
            placeholder="Нова парола (поне 8 знака)"
            value={pw.new_password}
            onChange={(e) => setPw({ ...pw, new_password: e.target.value })}
          />
          <Button
            variant="secondary"
            fullWidth
            disabled={busy || !pw.current_password || pw.new_password.length < 8}
            onClick={() => save(pw, "Паролата е сменена")}
          >
            Смени паролата
          </Button>
        </div>

        {msg && (
          <p className={`rounded-card px-3 py-2 text-sm ${msg.ok ? "bg-state-ok/10 text-state-ok" : "bg-state-danger/10 text-state-danger"}`}>
            {msg.text}
          </p>
        )}

        {isClient && (
          <div className="space-y-2 border-t border-line pt-4">
            <p className="text-sm font-semibold text-ink-2">Плащания</p>
            {payments.length === 0 && <p className="text-sm text-muted">Още няма плащания.</p>}
            {payments.map((p) => {
              const st = PAYMENT_STATUS[p.status] ?? { text: p.status, tone: "neutral" as const };
              return (
                <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-ink">
                    {formatMoney(p.amount)} · {p.method === "card" ? "карта" : "банка"} · {formatDateOnly(p.paid_at ?? p.created_at)}
                  </span>
                  <Badge tone={st.tone}>{st.text}</Badge>
                </div>
              );
            })}
            {invoices.length > 0 && <p className="pt-2 text-sm font-semibold text-ink-2">Фактури</p>}
            {invoices.map((inv) => (
              <a
                key={inv.id}
                href={`/api/invoices/${inv.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-touch items-center justify-between gap-2 rounded-card border border-line px-3 text-sm"
              >
                <span className="text-ink">
                  {inv.number} · {formatMoney(inv.amount)}
                </span>
                <Icon name="download" size={18} className="text-brand-primary" />
              </a>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
