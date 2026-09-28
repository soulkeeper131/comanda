"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet } from "./ui/Sheet";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Icon } from "./ui/Icon";
import { formatMoney, perMonthLabel } from "@/lib/format";
import { formatMonthDay } from "@/features/client/format";
import type { CatalogPackage } from "@/features/client/types";
import BankDetails from "@/features/client/BankDetails";

/**
 * Избор на пакет от истинския каталог (/api/packages). Един пакет = ядро
 * (обходи 1/2/4 пъти месечно) + опционални добавки с допълнителна цена.
 * Плаща се при заявката — карта (Stripe) или банков превод; след плащането
 * първият обход се уговаря по телефона.
 */
export default function PlanSelector({
  propertyId,
  onDone,
  onClose,
}: {
  propertyId: string;
  /** Извиква се след успешна заявка (и при затваряне, ако няма onClose). */
  onDone: () => void;
  onClose?: () => void;
}) {
  const [catalog, setCatalog] = useState<CatalogPackage[] | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [options, setOptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [bankPlan, setBankPlan] = useState<{ id: string; price: number } | null>(null);
  const [cardEnabled, setCardEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/payments/bank-details")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCardEnabled(Boolean(d?.card_enabled)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/packages")
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (!r.ok) throw new Error(d?.error || "Пакетите не могат да бъдат заредени.");
        return d as CatalogPackage[];
      })
      .then((list) => {
        if (cancelled) return;
        setCatalog(list);
        // Пакетът, избран на началната страница преди регистрацията.
        let preferred: string | null = null;
        try {
          preferred = localStorage.getItem("komanda_preferred_plan");
        } catch {
          /* private mode */
        }
        const first = list.find((p) => p.in_season && p.name === preferred) ?? list.find((p) => p.in_season);
        if (first) setSelectedId(first.id);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setCatalog([]);
          setError(e.message || "Пакетите не могат да бъдат заредени.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = catalog?.find((p) => p.id === selectedId) ?? null;
  const total = useMemo(() => {
    if (!selected) return 0;
    const extras = selected.items
      .filter((i) => i.optional && options.includes(i.id))
      .reduce((s, i) => s + i.extra_price, 0);
    return Math.round((selected.price + extras) * 100) / 100;
  }, [selected, options]);

  const close = onClose ?? onDone;

  const pick = (pkg: CatalogPackage) => {
    if (!pkg.in_season || pkg.id === selectedId) return;
    setSelectedId(pkg.id);
    setOptions([]);
  };

  const toggle = (id: string) =>
    setOptions((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = async (method: "card" | "bank") => {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/properties/${propertyId}/plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ package_id: selected.id, options, method }),
      });
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        // С карта — към Stripe; абонаментът тръгва след плащането.
        if (d.checkout_url) {
          window.location.href = d.checkout_url;
          return;
        }
        if (d.bank) setBankPlan({ id: d.id, price: d.price });
        try {
          localStorage.removeItem("komanda_preferred_plan");
        } catch {
          /* private mode */
        }
        setDone(true);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Заявката не беше приета. Опитайте отново.");
      }
    } catch {
      setError("Няма връзка. Проверете интернета и опитайте отново.");
    }
    setSaving(false);
  };

  return (
    <Sheet
      open
      onClose={done ? onDone : close}
      placement="bottom"
      className="mx-auto flex max-h-[92dvh] max-w-lg flex-col"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h3 className="text-lg font-bold text-ink">{done ? "Заявката е приета" : "Изберете пакет"}</h3>
        <button
          onClick={done ? onDone : close}
          className="-mr-2 flex h-touch w-touch items-center justify-center rounded-full text-muted hover:bg-brand-bg"
          aria-label="Затвори"
        >
          <Icon name="x" size={22} />
        </button>
      </div>

      {done ? (
        <div className="space-y-4 px-5 py-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-state-ok/10 text-state-ok">
            <Icon name="check-circle" size={30} />
          </div>
          <p className="text-base text-ink">
            {bankPlan
              ? "Заявката е приета. Преведете първия месец — щом преводът пристигне, ще ви се обадим за първия обход."
              : "Заявката е приета. Ще се свържем с вас, за да уговорим първия обход."}
          </p>
          {bankPlan && (
            <div className="text-left">
              <BankDetails kind="plan" id={bankPlan.id} amount={bankPlan.price} label={selected?.name} />
            </div>
          )}
          <Button fullWidth onClick={onDone}>
            Готово
          </Button>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {catalog === null && <p className="text-sm text-muted">Зареждане на пакетите…</p>}
            {catalog?.length === 0 && !error && (
              <p className="text-sm text-muted">В момента няма пакети в каталога.</p>
            )}
            {catalog?.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                selected={pkg.id === selectedId}
                options={options}
                onPick={() => pick(pkg)}
                onToggle={toggle}
              />
            ))}
            {error && (
              <p className="rounded-card bg-state-danger/10 px-3 py-2 text-sm text-state-danger">{error}</p>
            )}
          </div>

          <div className="border-t border-line px-5 py-3">
            {cardEnabled ? (
              <div className="space-y-2">
                <Button fullWidth size="lg" onClick={() => submit("card")} disabled={!selected || saving}>
                  <Icon name="card" size={18} />
                  {saving ? "Изпращане…" : selected ? `Плати с карта · ${formatMoney(total)} / месец` : "Изберете пакет"}
                </Button>
                <Button fullWidth variant="secondary" onClick={() => submit("bank")} disabled={!selected || saving}>
                  <Icon name="bank" size={18} /> По банков път
                </Button>
              </div>
            ) : (
              <Button fullWidth size="lg" onClick={() => submit("bank")} disabled={!selected || saving}>
                {saving ? "Изпращане…" : selected ? `Заявявам · ${formatMoney(total)} / месец` : "Изберете пакет"}
              </Button>
            )}
            <p className="mt-2 text-center text-xs text-muted">
              {cardEnabled
                ? "Картата се таксува всеки месец автоматично; по банка — превеждате всеки месец. Можете да прекратите по всяко време."
                : "Плащане по банков път всеки месец. Първият обход се уговаря, щом преводът пристигне."}
            </p>
          </div>
        </>
      )}
    </Sheet>
  );
}

function PackageCard({
  pkg,
  selected,
  options,
  onPick,
  onToggle,
}: {
  pkg: CatalogPackage;
  selected: boolean;
  options: string[];
  onPick: () => void;
  onToggle: (id: string) => void;
}) {
  const core = pkg.items.find((i) => !i.optional);
  const addons = pkg.items.filter((i) => i.optional);
  const saving = pkg.list_price != null && pkg.list_price > pkg.price ? pkg.list_price - pkg.price : 0;
  const seasonal = pkg.active_from && pkg.active_to;

  return (
    <div
      className={[
        "rounded-card border-2 transition-colors",
        selected ? "border-brand-primary bg-brand-primary/5" : "border-line bg-white",
        pkg.in_season ? "" : "opacity-60",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onPick}
        disabled={!pkg.in_season}
        className="flex w-full items-start gap-3 p-4 text-left disabled:cursor-not-allowed"
        aria-pressed={selected}
      >
        <span
          className={[
            "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
            selected ? "border-brand-primary bg-brand-primary text-white" : "border-line",
          ].join(" ")}
        >
          {selected && <Icon name="check" size={12} strokeWidth={3} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="font-bold text-ink">{pkg.name}</span>
            <span className="shrink-0 text-right">
              <span className="block font-bold text-brand-dark">{formatMoney(pkg.price)}</span>
              <span className="block text-xs text-muted">на месец</span>
            </span>
          </div>
          <div className="text-sm text-ink-2 first-letter:uppercase">{perMonthLabel(pkg.per_month)}</div>
          {pkg.description && <p className="mt-1 text-sm text-muted">{pkg.description}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {saving > 0 && <Badge tone="ok">спестявате {formatMoney(saving)}</Badge>}
            {seasonal && pkg.in_season && (
              <Badge tone="info">
                сезон {formatMonthDay(pkg.active_from)} – {formatMonthDay(pkg.active_to)}
              </Badge>
            )}
            {!pkg.in_season && <Badge tone="neutral">от {formatMonthDay(pkg.active_from)}</Badge>}
          </div>
          {core && (
            <p className="mt-2 flex items-start gap-1.5 text-sm text-ink">
              <Icon name="check" size={16} className="mt-0.5 text-state-ok" />
              <span>
                {core.template_name}
                {core.steps > 0 ? ` — ${core.steps} точки в чек-листа, всяка със снимка` : ""}
              </span>
            </p>
          )}
        </div>
      </button>

      {selected && addons.length > 0 && (
        <div className="space-y-1 border-t border-line px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Добавки</p>
          {addons.map((a) => (
            <label key={a.id} className="flex min-h-touch cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={options.includes(a.id)}
                onChange={() => onToggle(a.id)}
                className="h-5 w-5 shrink-0 accent-brand-primary"
              />
              <span className="min-w-0 flex-1 text-sm">
                <span className="block font-medium text-ink">{a.template_name}</span>
                <span className="block text-xs text-muted">{perMonthLabel(a.per_month)}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-brand-dark">+{formatMoney(a.extra_price)} / месец</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
