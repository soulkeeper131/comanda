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
  const [seasonal, setSeasonal] = useState(false);
  const [from, setFrom] = useState("10-01");
  const [to, setTo] = useState("04-30");
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
    setSeasonal(Boolean(pkg?.active_from));
    setFrom(pkg?.active_from ?? "10-01");
    setTo(pkg?.active_to ?? "04-30");
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
      active_from: seasonal ? from : null,
      active_to: seasonal ? to : null,
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
        <Field label="Описание">
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Основна услуга (обход)">
          <select className={inputClass} value={core} onChange={(e) => setCore(e.target.value)}>
            <option value="">— изберете —</option>
            {tplOptions}
          </select>
        </Field>
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
          <Field label="Без отстъпка">
            <input className={inputClass} inputMode="decimal" value={listPrice} onChange={(e) => setListPrice(e.target.value)} />
          </Field>
        </div>
        <label className="flex min-h-touch items-center gap-2 text-sm font-semibold text-ink-2">
          <input type="checkbox" className="h-5 w-5" checked={seasonal} onChange={(e) => setSeasonal(e.target.checked)} />
          Сезонен пакет
        </label>
        {seasonal && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="От (ММ-ДД)">
              <input className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} placeholder="10-01" />
            </Field>
            <Field label="До (ММ-ДД)">
              <input className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} placeholder="04-30" />
            </Field>
          </div>
        )}

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
