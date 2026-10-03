"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import FullScreenPanel from "./FullScreenPanel";

type Props = {
  propertyName: string;
  onClose: () => void;
  /** Връща текст на грешка или null при успех/опашка. */
  onSubmit: (reason: string) => Promise<string | null>;
};

const MIN_REASON = 5;

/** "Откажи обхода" — изисква причина (клиентът получава известие с нея). */
export default function CancelVisitSheet({ propertyName, onClose, onSubmit }: Props) {
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tooShort = reason.trim().length < MIN_REASON;

  const submit = async () => {
    if (tooShort) {
      setError(`Причината трябва да е поне ${MIN_REASON} символа.`);
      return;
    }
    setSending(true);
    setError(null);
    const err = await onSubmit(reason.trim());
    setSending(false);
    if (err) setError(err);
  };

  return (
    <FullScreenPanel
      title="Откажи обхода"
      subtitle={propertyName}
      onClose={onClose}
      footer={
        <>
          {error && <p className="rounded-card bg-state-danger/10 px-3 py-2 text-sm text-state-danger">{error}</p>}
          <Button fullWidth size="lg" variant="danger" disabled={sending} onClick={submit}>
            {sending ? "Изпращане…" : "Откажи обхода"}
          </Button>
          <Button fullWidth variant="ghost" onClick={onClose}>
            Назад
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-base text-ink">
          Обходът ще бъде отменен и клиентът ще получи известие с причината. Това не може да се върне от телефона.
        </p>
        <label className="block text-sm font-semibold text-ink" htmlFor="cancel-reason">
          Причина
        </label>
        <Textarea
          id="cancel-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="напр. Няма достъп до имота — никой не отговаря"
        />
      </div>
    </FullScreenPanel>
  );
}
