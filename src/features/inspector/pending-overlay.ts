// Какво вижда инспекторът = последното състояние от сървъра (или кеша) +
// чакащите в опашката действия върху него. Отхвърлено действие излиза от
// опашката → отметката/снимката изчезват сами (оптимистичното състояние се
// връща), а причината стои в списъка "отхвърлени".

import type { QueuedAction } from "@/lib/offline-queue";
import type { JobDetail } from "./types";

export type PendingFlags = {
  start: boolean;
  complete: boolean;
  cancel: boolean;
  /** Брой чакащи действия за този обход. */
  count: number;
};

export function pendingFlags(jobId: string, pending: QueuedAction[]): PendingFlags {
  const mine = pending.filter((a) => a.jobId === jobId);
  return {
    start: mine.some((a) => a.kind === "start"),
    complete: mine.some((a) => a.kind === "complete"),
    cancel: mine.some((a) => a.kind === "cancel"),
    count: mine.length,
  };
}

export function applyPending(detail: JobDetail, pending: QueuedAction[]): JobDetail {
  const mine = pending.filter((a) => a.jobId === detail.id);
  if (mine.length === 0) return detail;

  const items = detail.items.map((i) => ({ ...i, photos: [...i.photos] }));
  const photos = [...detail.photos];

  for (const a of mine) {
    if (a.kind === "photo") {
      const photo = { id: a.id, storage_path: "", taken_at: a.clientAt, localBlobKey: a.blobKey };
      const item = a.itemId ? items.find((i) => i.id === a.itemId) : undefined;
      if (item) item.photos.push(photo);
      else photos.push(photo);
    } else if (a.kind === "tick") {
      const item = items.find((i) => i.id === a.itemId);
      if (item) {
        item.done = a.done;
        item.pendingTick = true;
      }
    }
  }
  return { ...detail, items, photos };
}
