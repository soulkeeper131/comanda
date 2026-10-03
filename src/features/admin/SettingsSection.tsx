"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import TemplateManager from "@/components/TemplateManager";
import SmtpSettings from "@/components/SmtpSettings";
import { formatMoney } from "@/lib/format";
import { api } from "./api";
import TeamPanel from "./TeamPanel";
import { Chips, Field, SectionTitle, inputClass } from "./ui";
import type { AdminData, Resource } from "./useAdminData";

type Tab = "team" | "business" | "templates" | "email";

type Settings = {
  prepay_threshold: number;
  bank_iban: string;
  bank_recipient: string;
  bank_name: string;
  cron_configured: boolean;
  stripe_configured: boolean;
  push_configured: boolean;
  readiness: { key: string; label: string; ok: boolean; level: "required" | "recommended"; detail: string }[];
};

type CronResult = {
  jobs_created: number;
  offers_expired: number;
  offer_reminders: number;
  payment_reminders: number;
  plan_bank_payments?: number;
};

export default function SettingsSection({
  data,
  reload,
  toast,
  onThresholdChange,
}: {
  data: AdminData;
  reload: (...r: Resource[]) => Promise<void>;
  toast: (text: string, tone?: "ok" | "error") => void;
  onThresholdChange: (n: number) => void;
}) {
  const [tab, setTab] = useState<Tab>("business");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState({ prepay_threshold: "", bank_iban: "", bank_recipient: "", bank_name: "" });
  const [busy, setBusy] = useState(false);
  const [newService, setNewService] = useState({ name: "", category: "inspection" });
  const [templatesKey, setTemplatesKey] = useState(0);

  const loadSettings = () =>
    api<Settings>("/api/admin/settings").then((r) => {
      if (!r.ok) return;
      setSettings(r.data);
      setForm({
        prepay_threshold: String(r.data.prepay_threshold),
        bank_iban: r.data.bank_iban,
        bank_recipient: r.data.bank_recipient,
        bank_name: r.data.bank_name,
      });
    });
  useEffect(() => {
    loadSettings();
  }, []);

  const saveBusiness = async () => {
    setBusy(true);
    const res = await api<Settings>("/api/admin/settings", {
      method: "PATCH",
      body: { ...form, prepay_threshold: Number(form.prepay_threshold.replace(",", ".")) },
    });
    setBusy(false);
    if (!res.ok) return toast(res.error, "error");
    onThresholdChange(res.data.prepay_threshold);
    toast("Настройките са запазени");
    loadSettings();
  };

  const runCron = async () => {
    setBusy(true);
    const res = await api<CronResult>("/api/cron", { method: "POST" });
    setBusy(false);
    if (!res.ok) return toast(res.error, "error");
    const r = res.data;
    toast(
      `Нови обходи: ${r.jobs_created} · изтекли оферти: ${r.offers_expired} · напомняния: ${r.offer_reminders + r.payment_reminders} · преводи за абонаменти: ${r.plan_bank_payments ?? 0}`,
    );
    reload("jobs", "offers", "findings", "payments");
    loadSettings();
  };

  const backup = async () => {
    setBusy(true);
    const res = await api<{ filename: string }>("/api/admin/backup");
    setBusy(false);
    toast(res.ok ? `Копие на базата: ${res.data.filename}` : res.error, res.ok ? "ok" : "error");
  };

  const addService = async () => {
    const res = await api("/api/templates", { body: { name: newService.name.trim(), category: newService.category } });
    if (!res.ok) return toast(res.error, "error");
    setNewService({ name: "", category: newService.category });
    setTemplatesKey((k) => k + 1);
    toast("Услугата е създадена — добавете стъпките ѝ");
  };

  return (
    <div>
      <SectionTitle>Настройки</SectionTitle>
      <Chips
        value={tab}
        onChange={setTab}
        options={[
          { value: "team", label: "Хора" },
          { value: "business", label: "Плащания и задачи" },
          { value: "templates", label: "Услуги и чеклисти" },
          { value: "email", label: "Имейли" },
        ]}
      />

      {tab === "team" && (
        <TeamPanel
          users={data.users}
          onChanged={(m, tone) => {
            toast(m, tone);
            reload("users");
          }}
        />
      )}

      {tab === "business" && (
        <div className="space-y-3">
          {settings?.readiness && <ReadinessCard checks={settings.readiness} />}
          <Card className="space-y-3">
            <h3 className="font-bold text-ink">Плащане на ремонти</h3>
            <Field
              label="Праг за предплащане (€)"
              hint={`Под прага работата тръгва веднага и се плаща след нея; от прага нагоре — предварително. Сега: ${formatMoney(settings?.prepay_threshold)}.`}
            >
              <input
                className={inputClass}
                inputMode="decimal"
                value={form.prepay_threshold}
                onChange={(e) => setForm({ ...form, prepay_threshold: e.target.value })}
              />
            </Field>
            <h3 className="pt-2 font-bold text-ink">Банкова сметка за преводи</h3>
            <Field label="Получател">
              <input className={inputClass} value={form.bank_recipient} onChange={(e) => setForm({ ...form, bank_recipient: e.target.value })} />
            </Field>
            <Field label="IBAN">
              <input className={inputClass} value={form.bank_iban} onChange={(e) => setForm({ ...form, bank_iban: e.target.value })} />
            </Field>
            <Field label="Банка">
              <input className={inputClass} value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
            </Field>
            <Button disabled={busy} onClick={saveBusiness}>
              Запази
            </Button>
          </Card>

          <Card className="space-y-2">
            <h3 className="font-bold text-ink">Периодични задачи</h3>
            <p className="text-sm text-muted">
              Създава обходите от абонаментите три месеца напред, маркира изтеклите оферти и праща напомнянията.
              {settings?.cron_configured
                ? " На сървъра е настроено автоматично пускане."
                : " Автоматичното пускане не е настроено (CRON_SECRET) — пускайте ръчно или настройте Coolify."}
            </p>
            <Button variant="secondary" disabled={busy} onClick={runCron}>
              <Icon name="refresh" size={16} /> Пусни сега
            </Button>
          </Card>

          <Card className="space-y-2">
            <h3 className="font-bold text-ink">Резервно копие</h3>
            <p className="text-sm text-muted">
              Пълното нощно копие (база + снимки) се прави от scripts/backup-db.sh. Тук — само моментно копие на базата.
            </p>
            <Button variant="secondary" disabled={busy} onClick={backup}>
              <Icon name="download" size={16} /> Копие на базата
            </Button>
          </Card>

        </div>
      )}

      {tab === "templates" && (
        <div className="space-y-3">
          <Card className="flex flex-wrap items-end gap-2">
            <div className="min-w-[180px] flex-1">
              <Field label="Нова услуга">
                <input
                  className={inputClass}
                  value={newService.name}
                  onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                  placeholder="Напр. Почистване на прозорци"
                />
              </Field>
            </div>
            <select
              className={`${inputClass} w-auto`}
              aria-label="Вид"
              value={newService.category}
              onChange={(e) => setNewService({ ...newService, category: e.target.value })}
            >
              <option value="inspection">Обход</option>
              <option value="cleaning">Почистване</option>
              <option value="repair">Ремонт</option>
              <option value="custom">Друго</option>
            </select>
            <Button disabled={!newService.name.trim()} onClick={addService}>
              Добави
            </Button>
          </Card>
          <Card padding="none">
            <TemplateManager key={templatesKey} />
          </Card>
        </div>
      )}

      {tab === "email" && (
        <Card padding="none">
          <SmtpSettings />
        </Card>
      )}
    </div>
  );
}

/**
 * „Готово ли е за истински клиенти и пари" — задължителните неща първо.
 * Подробностите казват какво точно липсва и къде се настройва.
 */
function ReadinessCard({ checks }: { checks: Settings["readiness"] }) {
  const missing = checks.filter((c) => !c.ok && c.level === "required").length;
  return (
    <Card className={`space-y-2 ${missing ? "border-state-warning/50" : "border-state-ok/40"}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold text-ink">Готовност за работа</h3>
        <span className={`text-sm font-semibold ${missing ? "text-state-warning" : "text-state-ok"}`}>
          {missing ? `${missing} задължителни липсват` : "Всичко задължително е настроено"}
        </span>
      </div>
      <ul className="space-y-2">
        {checks.map((c) => (
          <li key={c.key} className="flex items-start gap-2 text-sm">
            <Icon
              name={c.ok ? "check-circle" : c.level === "required" ? "alert" : "clock"}
              size={18}
              className={c.ok ? "text-state-ok" : c.level === "required" ? "text-state-warning" : "text-muted"}
            />
            <div className="min-w-0">
              <div className="font-semibold text-ink">{c.label}</div>
              <div className="break-words text-muted">{c.detail}</div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

