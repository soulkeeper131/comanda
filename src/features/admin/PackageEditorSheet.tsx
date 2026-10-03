"use client";

import { parseAmount } from "@/lib/domain/templates";
import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { api } from "./api";
import { Field, inputClass } from "./ui";
import type { CatalogPackage, ServiceTemplate } from "./types";

type Option = { template_id: string; per_month: string; extra_price: string };

/** Готовите сезони — по-рядко се греши, отколкото с „ММ-ДД" на ръка. */
const SEASONS = [
  { value: "none", label: "Целогодишно", from: null, to: null },
  { value: "winter", label: "Зима — 1 октомври – 30 април", from: "10-01", to: "04-30" },
  { value: "summer", label: "Лято — 1 май – 30 септември", from: "05-01", to: "09-30" },
  { value: "custom", label: "Друг период…", from: null, to: null },
] as const;
type SeasonPreset = (typeof SEASONS)[number]["value"];

const MONTHS = ["януари", "февруари", "март", "април", "май", "юни", "юли", "август", "септември", "октомври", "ноември", "декември"];
const pad = (n: number) => String(n).padStart(2, "0");

function presetOf(from: string | null | undefined, to: string | null | undefined): SeasonPreset {
  if (!from || !to) return "none";
  return SEASONS.find((s) => s.from === from && s.to === to)?.value ?? "custom";
}

/** Месец и ден като две падащи менюта → "MM-DD". */
function MonthDay({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [m, d] = value.split("-").map(Number);
  return (
    <Field label={label}>
      <div className="grid grid-cols-[1fr_76px] gap-2">
        <select className={inputClass} value={m || 1} onChange={(e) => onChange(`${pad(Number(e.target.value))}-${pad(d || 1)}`)}>
          {MONTHS.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
        <select className={inputClass} aria-label={`${label} — ден`} value={d || 1} onChange={(e) => onChange(`${pad(m || 1)}-${pad(Number(e.target.value))}`)}>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </select>
      </div>
    </Field>
  );
}

/**
 * Пакет = ядро (обходът, с честотата на пакета) + опции по избор с добавка
 * към месечната цена (въпроси 1, 2, 6). Промяната важи за новите заявки —
 * вече заявените абонаменти пазят своята цена.
 */
export default function PackageEditorSheet({
  pkg,
  open,
  templates,
  onClose,
  onSaved,
}: {
  pkg: CatalogPackage | null;
  open: boolean;
  templates: ServiceTemplate[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [perMonth, setPerMonth] = useState("2");
  const [price, setPrice] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [season, setSeason] = useState<SeasonPreset>("none");
  const [from, setFrom] = useState("10-01");
  const [to, setTo] = useState("04-30");
  const [sort, setSort] = useState("");
  const [core, setCore] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    setName(pkg?.name ?? "");
    setDescription(pkg?.description ?? "");
    setPerMonth(String(pkg?.per_month ?? 2));
    setPrice(pkg ? String(pkg.price) : "");
    setListPrice(pkg?.list_price ? String(pkg.list_price) : "");
    setSeason(presetOf(pkg?.active_from, pkg?.active_to));
    setFrom(pkg?.active_from ?? "10-01");
    setTo(pkg?.active_to ?? "04-30");
    setSort(pkg?.sort != null ? String(pkg.sort) : "");
    setCore(pkg?.items.find((i) => !i.optional)?.template_id ?? templates.find((t) => t.category === "inspection")?.id ?? "");
    setOptions(
      (pkg?.items ?? [])
        .filter((i) => i.optional)
        .map((i) => ({ template_id: i.template_id, per_month: String(i.per_month), extra_price: String(i.extra_price) })),
    );
  }, [open, pkg, templates]);

  const submit = async () => {
    setBusy(true);
    setError("");
    const body = {
      name,
      description,
      per_month: Number(perMonth),
      price: parseAmount(price),
      list_price: listPrice ? parseAmount(listPrice) : null,
      active_from: season === "none" ? null : season === "custom" ? from : SEASONS.find((x) => x.value === season)!.from,
      active_to: season === "none" ? null : season === "custom" ? to : SEASONS.find((x) => x.value === season)!.to,
      sort: sort.trim() ? Number(sort) : undefined,
      items: [
        { template_id: core },
        ...options.map((o) => ({
          template_id: o.template_id,
          optional: true,
          per_month: Number(o.per_month),
          extra_price: parseAmount(o.extra_price),
        })),
      ],
    };
    const res = pkg
      ? await api(`/api/packages/${pkg.id}`, { method: "PATCH", body })
      : await api("/api/packages", { body });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onSaved(pkg ? "Пакетът е обновен" : "Пакетът е създаден");
  };

  // Какво ще проверява обходът в този пакет — за да се види, преди да се запази.
  const coreTpl = templates.find((t) => t.id === core);
  const coreSteps = coreTpl?.items ?? [];
  const bySeason = (k: string) => coreSteps.filter((i) => (i.season ?? "all") === k).length;

  const tplOptions = templates.map((t) => (
    <option key={t.id} value={t.id}>
      {t.name}
    </option>
  ));

  return (
    <Sheet open={open} onClose={onClose} placement="bottom" className="max-h-[92dvh] overflow-y-auto p-5">
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-ink">{pkg ? "Пакет" : "Нов пакет"}</h3>
        <Field label="Име">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Описание" hint="Клиентът го вижда при избора на пакет и на сайта.">
          <textarea
            className={`${inputClass} min-h-[72px] py-2`}
            maxLength={300}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field label="Основна услуга (обход)">
          <select className={inputClass} value={core} onChange={(e) => setCore(e.target.value)}>
            <option value="">— изберете —</option>
            {tplOptions}
          </select>
        </Field>
        {coreTpl && (
          <p className="-mt-1 rounded-card bg-brand-bg px-3 py-2 text-sm text-ink-2">
            Чек-лист: {coreSteps.length} точки — {bySeason("all")} винаги, {bySeason("winter")} зимни, {bySeason("summer")} летни.
            Обходът взима тези за деня си. Точките се променят от Настройки → Услуги и чеклисти.
          </p>
        )}
        <div className="grid grid-cols-3 gap-2">
          <Field label="Обходи/месец">
            <select className={inputClass} value={perMonth} onChange={(e) => setPerMonth(e.target.value)}>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="4">4</option>
            </select>
          </Field>
          <Field label="Цена €/мес">
            <input className={inputClass} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <Field label="Преди отстъпка">
            <input className={inputClass} inputMode="decimal" placeholder="по желание" value={listPrice} onChange={(e) => setListPrice(e.target.value)} />
          </Field>
        </div>
        <Field
          label="Кога работи"
          hint={season === "none" ? undefined : "Обходи и плащане само в този период — извън него клиентът не плаща."}
        >
          <select className={inputClass} value={season} onChange={(e) => setSeason(e.target.value as SeasonPreset)}>
            {SEASONS.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        </Field>
        {season === "custom" && (
          <div className="grid gap-2 sm:grid-cols-2">
            <MonthDay label="От" value={from} onChange={setFrom} />
            <MonthDay label="До" value={to} onChange={setTo} />
          </div>
        )}
        <Field label="Ред в каталога" hint="1 е най-отпред — така се подреждат и на сайта.">
          <input
            className={inputClass}
            inputMode="numeric"
            placeholder="най-отзад"
            value={sort}
            onChange={(e) => setSort(e.target.value.replace(/\D/g, "").slice(0, 3))}
          />
        </Field>

        <div>
          <div className="mb-1 text-sm font-semibold text-ink-2">Опции по избор</div>
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={i} className="grid grid-cols-[1fr_72px_84px_44px] items-end gap-2">
                <select
                  className={inputClass}
                  value={o.template_id}
                  onChange={(e) => setOptions((prev) => prev.map((x, j) => (j === i ? { ...x, template_id: e.target.value } : x)))}
                >
                  <option value="">— услуга —</option>
                  {tplOptions}
                </select>
                <select
                  className={inputClass}
                  aria-label="Пъти месечно"
                  value={o.per_month}
                  onChange={(e) => setOptions((prev) => prev.map((x, j) => (j === i ? { ...x, per_month: e.target.value } : x)))}
                >
                  <option value="1">1/м</option>
                  <option value="2">2/м</option>
                  <option value="4">4/м</option>
                </select>
                <input
                  className={inputClass}
                  aria-label="Добавка €"
                  inputMode="decimal"
                  placeholder="+ €"
                  value={o.extra_price}
                  onChange={(e) => setOptions((prev) => prev.map((x, j) => (j === i ? { ...x, extra_price: e.target.value } : x)))}
                />
                <button
                  className="flex h-11 w-11 items-center justify-center rounded-card text-muted hover:bg-brand-bg"
                  aria-label="Премахни"
                  onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                >
                  <Icon name="trash" size={18} />
                </button>
              </div>
            ))}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="mt-1"
            onClick={() => setOptions((prev) => [...prev, { template_id: "", per_month: "1", extra_price: "" }])}
          >
            <Icon name="plus" size={16} /> Опция
          </Button>
        </div>

        <p className="text-xs text-muted">
          Промените важат за новите заявки и за сайта веднага. Вече платените абонаменти пазят цената и опциите, с които са
          заявени.
        </p>
        {error && <p className="rounded-card bg-state-danger/10 px-3 py-2 text-sm text-state-danger">{error}</p>}
        <div className="flex gap-2 pb-2">
          {pkg && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                const res = await api(`/api/packages/${pkg.id}`, { method: "PATCH", body: { archived: !pkg.archived } });
                if (!res.ok) return setError(res.error);
                onSaved(pkg.archived ? "Пакетът е върнат в каталога" : "Пакетът е скрит от каталога");
              }}
            >
              {pkg.archived ? "Върни" : "Скрий"}
            </Button>
          )}
          <Button variant="secondary" className="ml-auto" onClick={onClose}>
            Отказ
          </Button>
          <Button disabled={busy || !name.trim() || !core || !(parseAmount(price) > 0)} onClick={submit}>
            Запази
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
