"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import PropertyForm, { type PropertyFormData } from "@/components/PropertyForm";
import { api } from "./api";

/**
 * Клиент с 0 имота. Основният случай за нов потребител — първото нещо,
 * което вижда след регистрация. Кани го да добави имота си и обяснява
 * какво следва: одобрение → пакет → обходи със снимки.
 */
export default function EmptyPropertyState({ onCreated }: { onCreated: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [created, setCreated] = useState(false);

  const handleAdd = async (data: PropertyFormData): Promise<string | void> => {
    if (!data.lat || !data.lng) return "Моля, изберете адрес от предложенията.";
    const res = await api("/api/properties", {
      method: "POST",
      body: {
        name: data.name,
        city: data.city,
        address: data.addr,
        lat: data.lat,
        lng: data.lng,
        kind: data.type,
        access_notes: data.access || undefined,
        contact_name: data.contact_name || undefined,
        contact_phone: data.contact_phone || undefined,
      },
    });
    if (!res.ok) return res.error;
    setCreated(true);
  };

  if (created) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <Card padding="lg" shadow="md" className="w-full max-w-md space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-state-ok/10 text-state-ok">
            <Icon name="check-circle" size={32} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-ink">Имотът чака одобрение</h2>
            <p className="text-sm text-muted">
              Ще проверим адреса и ще ви се обадим. След одобрението ще можете да изберете пакет за
              обслужване.
            </p>
          </div>
          <Button fullWidth size="lg" onClick={onCreated}>
            Към имота
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <Card padding="lg" shadow="md" className="w-full max-w-md space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-bg text-brand-primary">
          <Icon name="home" size={32} />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-ink">Все още нямате добавен имот</h2>
          <p className="text-sm text-muted">
            Добавете адреса му и ще видите тук какво предстои, какво е свършено и снимките от всеки
            обход — на едно място.
          </p>
        </div>

        <Button fullWidth size="lg" onClick={() => setShowForm(true)}>
          <Icon name="plus" size={20} />
          Добавете първия си имот
        </Button>

        <ol className="space-y-2 pt-2 text-left text-sm text-muted">
          <li className="flex gap-2">
            <span className="font-bold text-brand-primary">1.</span>
            Въвеждате адреса и кого да търсим на място.
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-brand-primary">2.</span>
            Проверяваме адреса, одобряваме имота и избирате пакет.
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-brand-primary">3.</span>
            Тук виждате всеки обход, снимките и откритите проблеми.
          </li>
        </ol>
      </Card>

      {showForm && <PropertyForm onAdd={handleAdd} onClose={() => setShowForm(false)} />}
    </div>
  );
}
