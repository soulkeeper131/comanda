"use client";

import { useCallback, useState } from "react";
import { getOfflineQueue, syncPending, type QueuedAction, type RejectedAction } from "@/lib/offline-sync";
import type { FindingInput } from "./ReportFindingSheet";
import type { InspectorJob, JobItemDetail } from "./types";

type Settled = { state: "done" } | { state: "queued" } | { state: "rejected"; entry: RejectedAction };

type Deps = {
  job: InspectorJob;
  online: boolean;
  /** Координатите от момента на действието (или null). */
  currentPosition: () => { lat: number | null; lng: number | null };
  reload: () => Promise<void>;
  onCompleted: () => void;
};

/**
 * Всяко действие по обхода минава през офлайн опашката — онлайн тя просто
 * се изпразва веднага. Така редът (снимка → отметка → завършване) е един и
 * същ с или без връзка, а сървърът проверява всичко при изпращането.
 */
export function useChecklistActions({ job, online, currentPosition, reload, onCompleted }: Deps) {
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [outOfRange, setOutOfRange] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const q = getOfflineQueue;

  const settle = useCallback(
    async (action: QueuedAction): Promise<Settled> => {
      if (online) await syncPending();
      const rejected = (await q().rejected()).find((r) => r.action.id === action.id);
      if (rejected) {
        // Показва се на място (във формата/долу) — не дублираме в списъка.
        await q().dismissRejected(action.id);
        return { state: "rejected", entry: rejected };
      }
      const stillPending = (await q().pending()).some((a) => a.id === action.id);
      return stillPending ? { state: "queued" } : { state: "done" };
    },
    [online, q],
  );

  const kick = useCallback(() => {
    if (online) void syncPending();
  }, [online]);

  const start = useCallback(async () => {
    const clientAt = new Date().toISOString();
    const { lat, lng } = currentPosition();
    setStarting(true);
    setStartError(null);
    setOutOfRange(false);
    const enqueue = () => q().enqueueStart({ jobId: job.id, lat, lng, clientAt });
    try {
      if (!online) {
        await enqueue();
        return;
      }
      // Онлайн — директно, за да видим веднага резултата от геофенсинга.
      const res = await fetch(`/api/jobs/${job.id}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: lat ?? undefined, lng: lng ?? undefined, client_at: clientAt }),
      });
      if (res.ok) {
        await reload();
        return;
      }
      if (res.status >= 500) {
        setStartError("Сървърът не отговаря. Опитайте отново след малко.");
        return;
      }
      const d = await res.json().catch(() => ({}));
      setStartError(d.error || "Грешка при стартиране на обхода.");
      // Извън периметъра инспекторът не може да прескочи проверката — само админ.
      setOutOfRange(d.distance_m !== undefined);
    } catch {
      // Връзката падна по време на заявката — записваме старта с тогавашните данни.
      await enqueue();
    } finally {
      setStarting(false);
    }
  }, [job.id, online, currentPosition, reload, q]);

  const toggle = useCallback(
    async (item: JobItemDetail) => {
      const done = !item.done;
      await q().enqueueTick({
        jobId: job.id,
        itemId: item.id,
        done,
        label: `${done ? "Отметка" : "Размаркиране"} „${item.label}“`,
      });
      kick();
    },
    [job.id, kick, q],
  );

  const addPhoto = useCallback(
    async (item: JobItemDetail | null, file: File) => {
      const { lat, lng } = currentPosition();
      await q().enqueuePhoto({
        jobId: job.id,
        itemId: item?.id ?? null,
        blob: file,
        lat,
        lng,
        label: item ? `Снимка към „${item.label}“` : "Снимка към обхода",
      });
      kick();
    },
    [job.id, currentPosition, kick, q],
  );

  const report = useCallback(
    async (item: JobItemDetail | null, input: FindingInput): Promise<string | null> => {
      const action = await q().enqueueFinding({
        jobId: job.id,
        itemId: item?.id ?? null,
        title: input.title,
        body: input.body,
        severity: input.severity,
        blobs: input.files,
      });
      const r = await settle(action);
      if (r.state === "rejected") return r.entry.reason;
      setNotice(
        r.state === "done"
          ? input.severity === "urgent"
            ? "Спешният сигнал е изпратен."
            : "Проблемът е докладван."
          : "Проблемът е записан и ще се изпрати при връзка.",
      );
      return null;
    },
    [job.id, settle, q],
  );

  const complete = useCallback(async () => {
    setCompleting(true);
    setCompleteError(null);
    try {
      const r = await settle(await q().enqueueComplete({ jobId: job.id }));
      if (r.state === "done") onCompleted();
      else if (r.state === "rejected") {
        const list = r.entry.details.length ? `: ${r.entry.details.join(", ")}` : "";
        setCompleteError(`${r.entry.reason}${list}`);
      } else setNotice("Завършването е записано и ще се изпрати при връзка — след снимките и отметките.");
    } finally {
      setCompleting(false);
    }
  }, [job.id, onCompleted, settle, q]);

  const cancel = useCallback(
    async (reason: string): Promise<string | null> => {
      const r = await settle(await q().enqueueCancel({ jobId: job.id, reason }));
      if (r.state === "rejected") return r.entry.reason;
      if (r.state === "done") onCompleted();
      else setNotice("Отказът е записан и ще се изпрати при връзка.");
      return null;
    },
    [job.id, onCompleted, settle, q],
  );

  return {
    start,
    starting,
    startError,
    outOfRange,
    toggle,
    addPhoto,
    report,
    complete,
    completing,
    completeError,
    cancel,
    notice,
    clearNotice: () => setNotice(null),
  };
}
