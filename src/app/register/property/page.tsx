"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Input, Select, Textarea } from "@/components/ui/Input";

const PROPERTY_KINDS = [
  { value: "apartment", label: "Апартамент" },
  { value: "house", label: "Къща" },
  { value: "villa", label: "Вила" },
  { value: "office", label: "Офис" },
  { value: "other", label: "Друго" },
];

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-brand-dark">
        {label} {optional && <span className="font-normal text-muted">(по желание)</span>}
      </span>
      {children}
    </label>
  );
}

export default function PropertyPage() {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [kind, setKind] = useState("apartment");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [accessNotes, setAccessNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) return setError("Името на имота е задължително");
    if (!city.trim()) return setError("Градът е задължителен");
    if (!address.trim()) return setError("Адресът е задължителен");

    setLoading(true);
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          city: city.trim(),
          address: address.trim(),
          kind,
          access_notes: accessNotes.trim() || undefined,
          contact_name: contactName.trim() || undefined,
          contact_phone: contactPhone.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Грешка при добавяне на имота");
        setLoading(false);
      } else {
        window.location.href = "/dashboard/onboarding";
      }
    } catch {
      setError("Възникна грешка. Опитайте отново.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-brand-bg p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="КОМАНДА" className="mx-auto mb-4 h-14" />
          <p className="text-sm text-brand-secondary">Стъпка 2 от 3 — Добавете своя имот</p>
        </div>

        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="h-1.5 flex-1 rounded-full bg-brand-primary" />
          <div className="h-1.5 flex-1 rounded-full bg-brand-primary" />
          <div className="h-1.5 flex-1 rounded-full bg-line" />
        </div>

        <Card padding="md" shadow="none" className="mb-6 bg-white/80 text-sm text-brand-dark">
          <p className="mb-2 flex items-center gap-2 font-semibold">
            <Icon name="shield" size={18} />
            Какво следва?
          </p>
          <p>
            Ще проверим адреса и ще ви се обадим, за да одобрим имота. След това избирате пакет и
            започваме обходите — всеки със снимков отчет.
          </p>
        </Card>

        <Card padding="lg" shadow="md">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-card bg-state-danger/10 px-3 py-2 text-sm font-medium text-state-danger">
                {error}
              </div>
            )}

            <Field label="Име на имота">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Напр. Апартамент София, Вила Боровец"
                required
              />
            </Field>

            <Field label="Град">
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="София, Варна, Боровец…" required />
            </Field>

            <Field label="Адрес">
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ул. Примерна №1" required />
            </Field>

            <Field label="Тип на имота">
              <Select value={kind} onChange={(e) => setKind(e.target.value)} className="text-brand-dark">
                {PROPERTY_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Контакт за достъп (име)" optional>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Кого да търси инспекторът на място"
                autoComplete="name"
              />
            </Field>

            <Field label="Телефон" optional>
              <Input
                type="tel"
                inputMode="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="08X XXX XXXX"
                autoComplete="tel"
              />
            </Field>

            <Field label="Бележки за достъп" optional>
              <Textarea
                value={accessNotes}
                onChange={(e) => setAccessNotes(e.target.value)}
                placeholder="Код на входа, етаж, ключове…"
                rows={2}
              />
            </Field>

            <Button type="submit" fullWidth size="lg" disabled={loading}>
              {loading ? "Запазване…" : "Добавете имота и продължете"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
