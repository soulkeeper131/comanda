"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { Icon } from "@/components/ui/Icon";
import { Notice, Section } from "./Section";
import { api, getOr } from "./api";
import { formatDateOnly, formatDay, formatWhen } from "./format";
import type { ClientJob } from "./types";


/** „Предстои" — следващите три обхода; планираните може да се местят. */
export default function UpcomingSection({
  jobs,
  hasLivePlan,
  onChanged,
}: {
  jobs: ClientJob[];
  hasLivePlan: boolean;
  onChanged: (msg: string) => void;
}) {
  const [moving, setMoving] = useState<ClientJob | null>(null);

  return (
    <Section title="Предстои" icon="calendar">
      {jobs.length === 0 ? (
        <p className="text-sm text-muted">
          {hasLivePlan
            ? "Все още няма насрочен обход. Ще видите датата тук, щом го уговорим с вас."
            : "Няма планирани обходи. Изберете пакет, за да започнем редовните проверки."}
        </p>
      ) : (
        <ul className="space-y-2">
          {jobs.map((job) => (
            <li key={job.id} className="flex items-center gap-3 rounded-card border border-line p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-bg text-brand-primary">
                <Icon name={job.status === "in_progress" ? "clock" : "calendar"} size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink first-letter:uppercase">
                  {job.status === "in_progress" ? "Обходът тече в момента" : formatDay(job.planned_at)}
                </div>
                <div className="truncate text-sm text-muted">
                  {job.title || "Обход"}
                  {job.assignee_name ? ` · ${job.assignee_name}` : ""}
                </div>
                {job.rescheduled_from && job.status === "planned" && (
                  <div className="text-xs text-muted">Преместен от {formatDateOnly(job.rescheduled_from)}</div>
                )}
              </div>
              {job.status === "in_progress" ? (
                <Badge tone="info">В момента</Badge>
              ) : (
                <Button size="sm" variant="secondary" className="min-h-touch" onClick={() => setMoving(job)}>
                  Премести
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {moving && (
        <RescheduleSheet
          job={moving}
          onClose={() => setMoving(null)}
          onDone={(date) => {
            setMoving(null);
            onChanged(`Обходът е преместен за ${formatWhen(date)}.`);
          }}
        />
      )}
    </Section>
  );
}

function RescheduleSheet({
  job,
  onClose,
  onDone,
}: {
  job: ClientJob;
  onClose: () => void;
  onDone: (date: string) => void;
}) {
  const current = job.planned_at.slice(0, 10);
  // Прозорецът идва от сървъра — същите правила като проверката там:
  // от утре, до 14 дни след първоначалната дата, преди следващия обход.
  const [range, setRange] = useState<{ min: string; max: string } | null | undefined>(undefined);
  const [date, setDate] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getOr<{ window: { min: string; max: string } | null }>(`/api/jobs/${job.id}/reschedule`, { window: null }).then((d) => {
      setRange(d.window);
      if (d.window && (current < d.window.min || current > d.window.max)) setDate(d.window.min);
    });
  }, [job.id, current]);
  const min = range?.min ?? "";
  const max = range?.max ?? "";

  const submit = async () => {
    setSaving(true);
    setError("");
    const res = await api(`/api/jobs/${job.id}/reschedule`, { method: "PATCH", body: { date } });
    setSaving(false);
    if (res.ok) onDone(date);
    else setError(res.error);
  };

  return (
    <Sheet open onClose={onClose} placement="bottom" className="mx-auto max-w-lg p-5">
      <h3 className="text-lg font-bold text-ink">Преместване на обход</h3>
      <p className="mt-1 text-sm text-muted">
        Сега: {formatDateOnly(job.planned_at)}.{" "}
        {range
          ? `Нов ден между ${formatDateOnly(range.min)} и ${formatDateOnly(range.max)}. Обходът е за целия ден; инспекторът ще бъде уведомен.`
          : range === null
            ? "Този обход не може да се мести повече — обадете ни се, ако е спешно."
            : "Зареждане…"}
      </p>
      <label className="mt-4 block text-sm font-semibold text-ink" htmlFor="reschedule-date">
        Нова дата
      </label>
      <Input
        id="reschedule-date"
        type="date"
        min={min}
        max={max}
        disabled={!range}
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="mt-1"
      />
      {error && (
        <div className="mt-3">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" fullWidth onClick={onClose}>
          Отказ
        </Button>
        <Button fullWidth onClick={submit} disabled={saving || !range || !date || date === current || date < min || date > max}>
          {saving ? "Запазване…" : "Премести"}
        </Button>
      </div>
    </Sheet>
  );
}
