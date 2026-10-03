"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { formatMoney } from "@/lib/format";
import {
  PROOF_TYPES,
  STEP_SEASONS,
  TEMPLATE_CATEGORIES,
  type ProofType,
  type StepSeasonKey,
  type TemplateCategory,
} from "@/lib/domain/templates";
import { api } from "./api";
import { EmptyState, Field, Loading, inputClass } from "./ui";

type Step = {
  id: string;
  template_id: string;
  zone_label: string | null;
  label: string;
  proof_type: ProofType;
  required: boolean | null;
  sort: number | null;
  season: StepSeasonKey | null;
};

type Service = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  duration_min: number | null;
  price: number | null;
  bookable: boolean | null;
  archived: boolean | null;
  items: Step[];
};

const CATEGORY_ICON: Record<string, IconName> = {
  inspection: "search",
  cleaning: "home",
  repair: "wrench",
  conservation: "shield",
  garden: "droplet",
  custom: "clipboard",
};

const SEASON_ORDER: StepSeasonKey[] = ["all", "winter", "summer"];

/**
 * Услугите и чек-листите им. Една услуга е или ядро на пакет (обходът), или
 * се заявява еднократно от клиента — тогава ѝ трябват цена и „Клиентът може
 * да я заяви". Точките в чек-листа може да са целогодишни, само зимни
 * (окт–апр) или само летни (май–сеп) — обходът взима тези за деня си.
 */
export default function ServicesPanel({ toast }: { toast: (text: string, tone?: "ok" | "error") => void }) {
  const [list, setList] = useState<Service[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<Service | null>(null);
  const [stepEdit, setStepEdit] = useState<{ service: Service; step: Step | null } | null>(null);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<TemplateCategory>("inspection");
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    const res = await api<Service[]>("/api/templates");
    if (res.ok) setList(res.data);
    else toast(res.error, "error");
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    const res = await api<Service>("/api/templates", { body: { name: newName.trim(), category: newCategory } });
    if (!res.ok) return toast(res.error, "error");
    setNewName("");
    await load();
    setOpenId(res.data.id);
    toast("Услугата е създадена — добавете цена и точките в чек-листа");
  };

  if (!list) return <Loading />;
  const shown = list.filter((s) => showArchived || !s.archived);
  const archivedCount = list.filter((s) => s.archived).length;

  return (
    <div className="space-y-3">
      <Card className="space-y-2">
        <p className="text-sm text-ink-2">
          Нова услуга — после ѝ дайте цена и чек-лист. Клиентите я виждат чак когато е включено „Клиентът може да я заяви“.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <input
            className={`${inputClass} min-w-[180px] flex-1`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Напр. Почистване на прозорци"
            aria-label="Име на новата услуга"
          />
          <select
            className={`${inputClass} w-auto`}
            aria-label="Вид"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as TemplateCategory)}
          >
            {Object.entries(TEMPLATE_CATEGORIES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button disabled={!newName.trim()} onClick={create}>
            <Icon name="plus" size={16} /> Добави
          </Button>
        </div>
      </Card>

      {shown.length === 0 && <EmptyState icon="clipboard" title="Няма услуги" />}

      {shown.map((s) => (
        <ServiceCard
          key={s.id}
          service={s}
          open={openId === s.id}
          onToggle={() => setOpenId(openId === s.id ? null : s.id)}
          onEditDetails={() => setDetails(s)}
          onEditStep={(step) => setStepEdit({ service: s, step })}
        />
      ))}

      {archivedCount > 0 && (
        <button className="min-h-touch w-full text-sm font-semibold text-brand-secondary" onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? "Скрий спрените услуги" : `Покажи спрените услуги (${archivedCount})`}
        </button>
      )}

      {details && (
        <DetailsSheet
          service={details}
          onClose={() => setDetails(null)}
          onSaved={async (text) => {
            setDetails(null);
            toast(text);
            await load();
          }}
          onError={(text) => toast(text, "error")}
        />
      )}
      {stepEdit && (
        <StepSheet
          service={stepEdit.service}
          step={stepEdit.step}
          onClose={() => setStepEdit(null)}
          onSaved={async (text) => {
            setStepEdit(null);
            toast(text);
            await load();
          }}
          onError={(text) => toast(text, "error")}
        />
      )}
    </div>
  );
}

function ServiceCard({
  service: s,
  open,
  onToggle,
  onEditDetails,
  onEditStep,
}: {
  service: Service;
  open: boolean;
  onToggle: () => void;
  onEditDetails: () => void;
  onEditStep: (step: Step | null) => void;
}) {
  const price = Number(s.price) || 0;
  const offered = Boolean(s.bookable) && !s.archived && price > 0;
  return (
    <Card padding="none" className={s.archived ? "opacity-70" : ""}>
      <button onClick={onToggle} className="flex min-h-touch w-full items-start gap-3 px-4 py-3 text-left" aria-expanded={open}>
        <span className="mt-0.5 text-brand-secondary">
          <Icon name={CATEGORY_ICON[s.category] ?? "clipboard"} size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink">{s.name}</span>
          <span className="block text-xs text-muted">
            {TEMPLATE_CATEGORIES[s.category as TemplateCategory] ?? s.category} · {s.duration_min ?? 60} мин · {s.items.length}{" "}
            {s.items.length === 1 ? "точка" : "точки"}
          </span>
          <span className="mt-1 flex flex-wrap gap-1.5">
            {s.archived ? (
              <Badge>Спряна</Badge>
            ) : offered ? (
              <Badge tone="ok">Заявява се · {formatMoney(price)}</Badge>
            ) : s.bookable ? (
              <Badge tone="warning">Без цена — клиентът не я вижда</Badge>
            ) : (
              <Badge tone="info">Само в пакет</Badge>
            )}
          </span>
        </span>
        <Icon name="chevron-down" size={20} className={`mt-1 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-line px-4 py-3">
          {s.description && <p className="text-sm text-ink-2">{s.description}</p>}
          <Button size="sm" variant="secondary" onClick={onEditDetails}>
            <Icon name="edit" size={16} /> Име, цена, видимост
          </Button>

          {SEASON_ORDER.map((season) => {
            const steps = s.items.filter((i) => (i.season ?? "all") === season);
            if (steps.length === 0 && season !== "all") return null;
            return (
              <div key={season}>
                <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                  {season === "winter" && <Icon name="snowflake" size={14} />}
                  {season === "summer" && <Icon name="sun" size={14} />}
                  {STEP_SEASONS[season]}
                </div>
                {steps.length === 0 ? (
                  <p className="text-sm text-muted">Няма точки.</p>
                ) : (
                  <ul className="divide-y divide-line rounded-card border border-line">
                    {steps.map((step) => (
                      <li key={step.id}>
                        <button onClick={() => onEditStep(step)} className="flex min-h-touch w-full items-start gap-2 px-3 py-2 text-left hover:bg-brand-bg">
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm text-ink">{step.label}</span>
                            <span className="block text-xs text-muted">
                              {[step.zone_label, PROOF_TYPES[step.proof_type] ?? step.proof_type, step.required ? "задължителна" : "по желание"]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                          <Icon name="edit" size={16} className="mt-1 shrink-0 text-muted" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          <Button size="sm" variant="ghost" onClick={() => onEditStep(null)}>
            <Icon name="plus" size={16} /> Добави точка
          </Button>
        </div>
      )}
    </Card>
  );
}

function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      <button onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full text-muted" aria-label="Затвори">
        <Icon name="x" />
      </button>
    </div>
  );
}

function DetailsSheet({
  service,
  onClose,
  onSaved,
  onError,
}: {
  service: Service;
  onClose: () => void;
  onSaved: (text: string) => void;
  onError: (text: string) => void;
}) {
  const [form, setForm] = useState({
    name: service.name,
    description: service.description ?? "",
    category: service.category,
    duration_min: String(service.duration_min ?? 60),
    price: String(service.price ?? 0).replace(".", ","),
    bookable: Boolean(service.bookable),
    archived: Boolean(service.archived),
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const res = await api(`/api/templates/${service.id}`, {
      method: "PATCH",
      body: { ...form, duration_min: Number(form.duration_min) },
    });
    setBusy(false);
    if (!res.ok) return onError(res.error);
    onSaved("Услугата е запазена");
  };

  return (
    <Sheet open onClose={onClose} placement="bottom" className="mx-auto max-h-[92dvh] max-w-lg overflow-y-auto p-5">
      <div className="space-y-3">
        <SheetHeader title="Услуга" onClose={onClose} />
        <Field label="Име">
          <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Описание" hint="Клиентът го вижда при заявка и на сайта.">
          <textarea
            className={`${inputClass} min-h-[80px] py-2`}
            value={form.description}
            maxLength={500}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Цена при заявка (€)">
            <input className={inputClass} inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </Field>
          <Field label="Продължителност (мин)">
            <input
              className={inputClass}
              inputMode="numeric"
              value={form.duration_min}
              onChange={(e) => setForm({ ...form, duration_min: e.target.value.replace(/\D/g, "") })}
            />
          </Field>
        </div>
        <Field label="Вид">
          <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {Object.entries(TEMPLATE_CATEGORIES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex min-h-touch items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 accent-brand-primary"
            checked={form.bookable}
            onChange={(e) => setForm({ ...form, bookable: e.target.checked })}
          />
          <span className="text-sm text-ink">
            Клиентът може да я заяви от приложението
            <span className="block text-xs text-muted">Еднократно, срещу цената по-горе. Вижда се и на сайта.</span>
          </span>
        </label>
        <label className="flex min-h-touch items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 accent-brand-primary"
            checked={form.archived}
            onChange={(e) => setForm({ ...form, archived: e.target.checked })}
          />
          <span className="text-sm text-ink">
            Спряна
            <span className="block text-xs text-muted">Не се предлага; историята и пакетите, които я ползват, остават.</span>
          </span>
        </label>
        <div className="flex gap-2 pb-2">
          <Button variant="secondary" fullWidth onClick={onClose}>
            Отказ
          </Button>
          <Button fullWidth disabled={busy || !form.name.trim()} onClick={save}>
            Запази
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function StepSheet({
  service,
  step,
  onClose,
  onSaved,
  onError,
}: {
  service: Service;
  step: Step | null;
  onClose: () => void;
  onSaved: (text: string) => void;
  onError: (text: string) => void;
}) {
  const [form, setForm] = useState({
    zone_label: step?.zone_label ?? "",
    label: step?.label ?? "",
    proof_type: (step?.proof_type ?? "photo") as ProofType,
    season: (step?.season ?? "all") as StepSeasonKey,
    required: step ? Boolean(step.required) : true,
  });
  const [busy, setBusy] = useState(false);
  const ordered = [...service.items].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  const index = step ? ordered.findIndex((i) => i.id === step.id) : -1;

  const save = async () => {
    setBusy(true);
    const res = step
      ? await api(`/api/template-items/${step.id}`, { method: "PATCH", body: form })
      : await api("/api/template-items", { body: { ...form, template_id: service.id } });
    setBusy(false);
    if (!res.ok) return onError(res.error);
    onSaved(step ? "Точката е запазена" : "Точката е добавена");
  };

  const remove = async () => {
    if (!step || !confirm("Да махнем тази точка от чек-листа? Вече направените обходи не се променят.")) return;
    setBusy(true);
    const res = await api(`/api/template-items/${step.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return onError(res.error);
    onSaved("Точката е махната");
  };

  // Местене нагоре/надолу — номерира реда наново, за да няма равни позиции.
  const move = async (delta: -1 | 1) => {
    if (!step) return;
    const target = index + delta;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true);
    for (const [i, item] of next.entries()) {
      if (item.sort === i + 1) continue;
      const res = await api(`/api/template-items/${item.id}`, { method: "PATCH", body: { sort: i + 1 } });
      if (!res.ok) {
        setBusy(false);
        return onError(res.error);
      }
    }
    setBusy(false);
    onSaved("Редът е сменен");
  };

  return (
    <Sheet open onClose={onClose} placement="bottom" className="mx-auto max-h-[92dvh] max-w-lg overflow-y-auto p-5">
      <div className="space-y-3">
        <SheetHeader title={step ? "Точка от чек-листа" : "Нова точка"} onClose={onClose} />
        <p className="text-sm text-muted">{service.name}</p>
        <Field label="Какво се проверява">
          <input
            className={inputClass}
            value={form.label}
            maxLength={200}
            placeholder="Напр. Тръби в мазето — без лед и пукнатини"
            onChange={(e) => setForm({ ...form, label: e.target.value })}
          />
        </Field>
        <Field label="Зона (по желание)">
          <input
            className={inputClass}
            value={form.zone_label}
            maxLength={60}
            placeholder="Баня, Кухня, Двор…"
            onChange={(e) => setForm({ ...form, zone_label: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Доказателство">
            <select className={inputClass} value={form.proof_type} onChange={(e) => setForm({ ...form, proof_type: e.target.value as ProofType })}>
              {Object.entries(PROOF_TYPES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Кога">
            <select className={inputClass} value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value as StepSeasonKey })}>
              {SEASON_ORDER.map((value) => (
                <option key={value} value={value}>
                  {STEP_SEASONS[value]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <label className="flex min-h-touch items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 accent-brand-primary"
            checked={form.required}
            onChange={(e) => setForm({ ...form, required: e.target.checked })}
          />
          <span className="text-sm text-ink">
            Задължителна
            <span className="block text-xs text-muted">Обходът не приключва без нея. Махнете отметката за неща, които не всеки имот има.</span>
          </span>
        </label>
        {step && (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={busy || index <= 0} onClick={() => move(-1)}>
              По-нагоре
            </Button>
            <Button size="sm" variant="secondary" disabled={busy || index >= ordered.length - 1} onClick={() => move(1)}>
              По-надолу
            </Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2 pb-2">
          <Button fullWidth disabled={busy || !form.label.trim()} onClick={save}>
            Запази
          </Button>
          {step && (
            <Button fullWidth variant="ghost" className="text-state-danger" disabled={busy} onClick={remove}>
              <Icon name="trash" size={16} /> Махни точката
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
