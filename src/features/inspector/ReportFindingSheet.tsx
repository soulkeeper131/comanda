"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Input, Textarea } from "@/components/ui/Input";
import FullScreenPanel from "./FullScreenPanel";

export type FindingInput = {
  title: string;
  body: string;
  severity: "normal" | "urgent";
  files: File[];
};

type Props = {
  /** Стъпката, от която се докладва; null = общ проблем за обхода. */
  itemLabel: string | null;
  online: boolean;
  onClose: () => void;
  /** Връща текст на грешка или null при успех/опашка. */
  onSubmit: (input: FindingInput) => Promise<string | null>;
};

/**
 * "Докладвай проблем" (въпрос 17). Степента е изричен избор с две големи
 * опции — спешният сигнал веднага известява админа И собственика, затова
 * по подразбиране е "Обикновен" и спешният иска потвърждение.
 */
export default function ReportFindingSheet({ itemLabel, online, onClose, onSubmit }: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<"normal" | "urgent">("normal");
  const [files, setFiles] = useState<File[]>([]);
  const [confirmUrgent, setConfirmUrgent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const submit = async () => {
    if (!title.trim()) {
      setError("Напишете накратко какъв е проблемът.");
      return;
    }
    if (severity === "urgent" && !confirmUrgent) {
      setConfirmUrgent(true);
      return;
    }
    setSending(true);
    setError(null);
    const err = await onSubmit({ title: title.trim(), body: body.trim(), severity, files });
    setSending(false);
    if (err) setError(err);
  };

  const pick = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  };

  return (
    <FullScreenPanel
      title="Докладвай проблем"
      subtitle={itemLabel ? `Стъпка: ${itemLabel}` : "Общ проблем за обхода"}
      onClose={onClose}
      footer={
        <>
          {error && <p className="rounded-card bg-state-danger/10 px-3 py-2 text-sm text-state-danger">{error}</p>}
          {confirmUrgent && severity === "urgent" && (
            <p className="rounded-card bg-state-danger/10 px-3 py-2 text-sm font-semibold text-state-danger">
              Спешният сигнал веднага известява администратора И собственика на имота. Изпращате ли?
            </p>
          )}
          <Button
            fullWidth
            size="lg"
            variant={severity === "urgent" ? "danger" : "primary"}
            disabled={sending}
            onClick={submit}
          >
            {sending
              ? "Изпращане…"
              : severity === "urgent"
                ? confirmUrgent
                  ? "Да, изпрати спешно"
                  : "Изпрати спешен сигнал"
                : "Изпрати"}
          </Button>
          {!online && (
            <p className="text-center text-sm text-muted">Няма връзка — ще се изпрати автоматично при връзка.</p>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink" htmlFor="finding-title">
            Какъв е проблемът?
          </label>
          <Input
            id="finding-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="напр. Теч под мивката"
            maxLength={200}
          />
        </div>

        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink">Колко е спешно?</p>
          <div className="grid gap-2">
            <SeverityOption
              active={severity === "normal"}
              onClick={() => {
                setSeverity("normal");
                setConfirmUrgent(false);
              }}
              title="Обикновен"
              hint="Администраторът ще го прегледа."
            />
            <SeverityOption
              active={severity === "urgent"}
              danger
              onClick={() => setSeverity("urgent")}
              title="Спешен — теч, ток, опасност"
              hint="Веднага известява администратора и собственика."
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink" htmlFor="finding-body">
            Описание (по желание)
          </label>
          <Textarea id="finding-body" value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
        </div>

        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink">Снимки</p>
          <div className="flex flex-wrap gap-2">
            {previews.map((src, i) => (
              <div key={src} className="relative h-20 w-20 overflow-hidden rounded-lg border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Снимка ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center bg-ink/70 text-white"
                  aria-label="Махни снимката"
                >
                  <Icon name="x" size={18} />
                </button>
              </div>
            ))}
            <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-brand-primary/40 text-xs font-semibold text-brand-secondary">
              <Icon name="camera" size={24} />
              Снимка
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => {
                  pick(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      </div>
    </FullScreenPanel>
  );
}

function SeverityOption({
  active,
  danger,
  onClick,
  title,
  hint,
}: {
  active: boolean;
  danger?: boolean;
  onClick: () => void;
  title: string;
  hint: string;
}) {
  const activeCls = danger ? "border-state-danger bg-state-danger/10" : "border-brand-primary bg-brand-bg";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-[64px] w-full items-center gap-3 rounded-card border-2 px-4 py-3 text-left ${
        active ? activeCls : "border-line bg-white"
      }`}
    >
      <span
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 ${
          active ? (danger ? "border-state-danger bg-state-danger" : "border-brand-primary bg-brand-primary") : "border-line"
        } text-white`}
      >
        {active && <Icon name="check" size={16} strokeWidth={3} />}
      </span>
      <span>
        <span className={`block text-base font-bold ${danger ? "text-state-danger" : "text-ink"}`}>{title}</span>
        <span className="block text-sm text-muted">{hint}</span>
      </span>
    </button>
  );
}
