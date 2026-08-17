"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import PropertyForm from "@/components/PropertyForm";
import PlanSelector from "@/components/PlanSelector";

/**
 * Клиент с 0 имота. Основният случай за нов потребител — не бележка под
 * линия, а първото нещо, което вижда след регистрация. Кани го да добави
 * имота си, обяснява какво следва, без да го праща в табове.
 */
export default function EmptyPropertyState({ onCreated }: { onCreated: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [newPropertyId, setNewPropertyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleAdd = async (data: {
    name: string;
    city: string;
    addr: string;
    type: string;
    access: string;
    lat?: number;
    lng?: number;
  }) => {
    if (!data.lat || !data.lng) {
      setError("Моля, изберете адрес от предложенията.");
      return;
    }
    setError("");
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          city: data.city,
          address: data.addr,
          lat: data.lat,
          lng: data.lng,
          kind: data.type,
        }),
      });
      if (res.ok) {
        const prop = await res.json();
        setShowForm(false);
        setNewPropertyId(prop.id);
      } else {
        setError("Грешка при добавяне на имота. Опитайте отново.");
      }
    } catch {
      setError("Грешка при добавяне на имота. Проверете връзката.");
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <Card padding="lg" shadow="md" className="max-w-md w-full space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-bg text-3xl">
          🏠
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-ink">Все още нямате добавен имот</h2>
          <p className="text-sm text-muted">
            Добавете адреса му и ще видите тук какво предстои, какво е свършено
            и снимките от всеки обход — на едно място.
          </p>
        </div>

        {error && (
          <p className="rounded-lg bg-state-danger/10 px-3 py-2 text-sm text-state-danger">{error}</p>
        )}

        <Button fullWidth size="lg" onClick={() => setShowForm(true)}>
          Добавете първия си имот
        </Button>

        <ul className="space-y-2 pt-2 text-left text-sm text-muted">
          <li className="flex gap-2">
            <span className="font-bold text-brand-primary">1.</span>
            Въвеждате адреса — намираме координатите автоматично.
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-brand-primary">2.</span>
            Избирате пакет за обслужване (по желание — може и по-късно).
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-brand-primary">3.</span>
            Тук ще виждате всеки обход, снимките и констатациите.
          </li>
        </ul>
      </Card>

      {showForm && <PropertyForm onAdd={handleAdd} onClose={() => setShowForm(false)} />}

      {newPropertyId && (
        <PlanSelector
          propertyId={newPropertyId}
          onDone={() => {
            setNewPropertyId(null);
            onCreated();
          }}
        />
      )}
    </div>
  );
}
