"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import PropertyForm from "@/components/PropertyForm";
import { createProperty } from "@/features/client/EmptyPropertyState";

/**
 * Стъпка 2 от регистрацията — имотът. Същата форма като в таблото, с
 * търсене на адреса: без избран адрес от предложенията сървърът не може да
 * сложи имота на картата, а обикновено поле водеше до задънена улица.
 */
export default function PropertyPage() {
  const [open, setOpen] = useState(true);

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

        <Button fullWidth size="lg" onClick={() => setOpen(true)}>
          <Icon name="plus" size={20} /> Добавете имота
        </Button>
        <a href="/dashboard" className="mt-4 block text-center text-sm font-semibold text-brand-secondary">
          По-късно — към профила
        </a>
      </div>

      {open && (
        <PropertyForm
          submitLabel="Добавете и продължете"
          onAdd={async (data) => {
            const err = await createProperty(data);
            if (err) return err;
            window.location.href = "/dashboard?welcome=1";
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
