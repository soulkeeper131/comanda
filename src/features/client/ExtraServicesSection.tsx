"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Sheet } from "@/components/ui/Sheet";
import { Icon } from "@/components/ui/Icon";
import { addDaysKey, formatDay, formatMoney, todayKey } from "@/lib/format";
import { api, getOr } from "./api";
import { Notice, Section } from "./Section";
import BankDetails from "./BankDetails";

type Service = { id: string; name: string; description: string | null; price: number | null; category: string; archived: boolean | null; bookable: boolean | null };
type Order = {
  id: string;
  template_name: string;
  requested_date: string;
  note: string | null;
  price: number;
  status: "pending_payment" | "paid" | "cancelled";
  pay_method: "card" | "bank" | null;
};

const input =
  "w-full min-h-touch rounded-card border border-line bg-white px-3 text-field text-ink focus:border-brand-primary focus:outline-none";

/**
 * Допълнителни услуги (уточнение 6б): „този месец искам и прозорците".
 * Заявява се веднъж, плаща се веднъж, става един обход на избраната дата.
 */
export default function ExtraServicesSection({
  propertyId,
  approved,
  onChanged,
}: {
  propertyId: string;
  approved: boolean;
  onChanged: (msg: string) => void;
}) {
  const [services, setServices] = useState<Service[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(addDaysKey(todayKey(), 3));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [s, o] = await Promise.all([
      getOr<Service[]>("/api/templates", []),
      getOr<Order[]>(`/api/properties/${propertyId}/orders`, []),
    ]);
    setServices(s.filter((x) => !x.archived && x.bookable && Number(x.price) > 0));
    setOrders(o.filter((x) => x.status !== "cancelled"));
  }, [propertyId]);

  useEffect(() => {
    if (approved) load();
  }, [approved, load]);

  if (!approved || services.length === 0) return null;

  const selected = services.find((s) => s.id === serviceId);
  const pending = orders.filter((o) => o.status === "pending_payment");
  const upcoming = orders.filter((o) => o.status === "paid" && o.requested_date >= todayKey());

  const submit = async (method: "card" | "bank") => {
    setBusy(true);
    setError("");
    const res = await api<{ checkout_url?: string; bank?: boolean }>(`/api/properties/${propertyId}/orders`, {
      method: "POST",
      body: { template_id: serviceId, date, note, method },
    });
    if (!res.ok) {
      setBusy(false);
      return setError(res.error);
    }
    if (res.data.checkout_url) {
      window.location.href = res.data.checkout_url;
      return;
    }
    setBusy(false);
    setOpen(false);
    setNote("");
    onChanged(res.data.bank ? "Заявката е приета — ще я насрочим, щом преводът пристигне." : "Услугата е насрочена.");
    load();
  };

  const withdraw = async (id: string) => {
    const res = await api(`/api/orders/${id}`, { method: "DELETE" });
    onChanged(res.ok ? "Заявката е оттеглена." : res.error);
    load();
  };

  return (
    <Section
      title="Допълнителни услуги"
      icon="plus"
      action={
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Заяви
        </Button>
      }
    >
      {orders.length === 0 && (
        <p className="text-sm text-muted">Еднократно, извън абонамента — напр. почистване или проверка след ремонт.</p>
      )}
      <div className="space-y-3">
        {upcoming.map((o) => (
          <div key={o.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-ink">
              {o.template_name} · {formatDay(o.requested_date)}
            </span>
            <Badge tone="ok">Насрочена</Badge>
          </div>
        ))}
        {pending.map((o) => (
          <div key={o.id} className="space-y-2 rounded-card border border-line p-3">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-semibold text-ink">
                {o.template_name} · {formatDay(o.requested_date)}
              </span>
              <Badge tone="warning">Чака плащане</Badge>
            </div>
            {o.pay_method === "bank" ? (
              <BankDetails kind="order" id={o.id} amount={o.price} label={o.template_name} />
            ) : (
              <p className="text-sm text-muted">Плащането с карта не е завършено. Оттеглете заявката и я направете отново.</p>
            )}
            <Button size="sm" variant="ghost" className="text-state-danger" onClick={() => withdraw(o.id)}>
              Оттегли заявката
            </Button>
          </div>
        ))}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} placement="bottom" className="max-h-[90dvh] overflow-y-auto p-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-ink">Допълнителна услуга</h3>
            <button onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-full text-muted" aria-label="Затвори">
              <Icon name="x" />
            </button>
          </div>
          <div className="space-y-2">
            {services.map((s) => (
              <button
                key={s.id}
                onClick={() => setServiceId(s.id)}
                className={`flex w-full items-start justify-between gap-3 rounded-card border p-3 text-left ${
                  serviceId === s.id ? "border-brand-primary bg-brand-primary/5" : "border-line"
                }`}
              >
                <div>
                  <div className="font-semibold text-ink">{s.name}</div>
                  {s.description && <div className="text-sm text-muted">{s.description}</div>}
                </div>
                <div className="shrink-0 font-bold text-brand-dark">{formatMoney(s.price)}</div>
              </button>
            ))}
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-ink-2">Дата</span>
            <input
              type="date"
              className={input}
              min={todayKey()}
              max={addDaysKey(todayKey(), 60)}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-ink-2">Бележка (по желание)</span>
            <textarea className={`${input} min-h-[72px] py-2`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </label>
          {date === todayKey() && <p className="text-sm text-muted">За днес — само с карта, за да тръгнем веднага.</p>}
          {error && <Notice tone="danger">{error}</Notice>}
          <div className="flex flex-col gap-2 pb-2 sm:flex-row">
            <Button fullWidth disabled={busy || !selected} onClick={() => submit("card")}>
              <Icon name="card" size={18} /> {selected ? `Плати ${formatMoney(selected.price)}` : "Изберете услуга"}
            </Button>
            <Button fullWidth variant="secondary" disabled={busy || !selected || date === todayKey()} onClick={() => submit("bank")}>
              <Icon name="bank" size={18} /> По банков път
            </Button>
          </div>
        </div>
      </Sheet>
    </Section>
  );
}
