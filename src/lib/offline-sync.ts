// Браузърната страна на офлайн режима (N2): една опашка за приложението
// (IndexedDB), автоматична синхронизация при "online", кеш на обходите за
// работа без връзка. Логиката на опашката е в offline-queue.ts (тестваема).

import { createOfflineQueue, createMemoryStore, type KVStore, type OfflineQueue, type QueuedAction, type SyncResult } from "./offline-queue";
import { createIdbStore } from "./offline-queue-idb";

export type { QueuedAction, RejectedAction, SyncResult } from "./offline-queue";

export const QUEUE_CHANGED_EVENT = "offline-queue-changed";
export const SYNC_COMPLETE_EVENT = "offline-sync-complete";

const COUNT_KEY = "komanda_queue_length";
const LEGACY_KEY = "komanda_pending_actions";

let queue: OfflineQueue | null = null;
let store: KVStore | null = null;
let lastCount = 0;
let lastCountLoaded = false;

const isBrowser = () => typeof window !== "undefined";

function getStore() {
  if (!store) store = isBrowser() ? createIdbStore() : createMemoryStore();
  return store;
}

function setCount(n: number) {
  lastCount = n;
  try {
    localStorage.setItem(COUNT_KEY, String(n));
  } catch {
    // без localStorage броячът живее само в паметта
  }
}

export function getOfflineQueue(): OfflineQueue {
  if (!queue) {
    queue = createOfflineQueue({
      store: getStore(),
      fetch: (url, init) => fetch(url, { ...init, credentials: "same-origin" }),
      onChange: (state) => {
        setCount(state.pending.length);
        if (isBrowser()) window.dispatchEvent(new CustomEvent(QUEUE_CHANGED_EVENT, { detail: state }));
      },
      onSynced: patchCacheAfterSync,
    });
  }
  return queue;
}

/** Синхронно (за Topbar) — броят чакащи действия от последната промяна. */
export function getQueueLength(): number {
  if (!lastCountLoaded && isBrowser()) {
    lastCountLoaded = true;
    try {
      lastCount = Number(localStorage.getItem(COUNT_KEY) ?? 0) || 0;
    } catch {
      lastCount = 0;
    }
  }
  return lastCount;
}

export async function syncPending(): Promise<SyncResult> {
  const result = await getOfflineQueue().sync();
  if (isBrowser()) window.dispatchEvent(new CustomEvent(SYNC_COMPLETE_EVENT, { detail: result }));
  return result;
}

/**
 * @deprecated Старата опашка на ChecklistSheet. Минава през новата — при
 * 4xx действието е в "отхвърлени", не изчезва.
 */
export function queueAction(action: { method: "POST" | "PATCH" | "PUT" | "DELETE"; url: string; body?: unknown }) {
  void getOfflineQueue().enqueueRaw(action);
}

let initialized = false;

export function initOfflineSync() {
  if (!isBrowser() || initialized) return;
  initialized = true;
  const q = getOfflineQueue();

  // Пренасяме действия от старата localStorage опашка.
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]") as { method: "POST"; url: string; body?: unknown }[];
    localStorage.removeItem(LEGACY_KEY);
    for (const a of legacy) void q.enqueueRaw({ method: a.method, url: a.url, body: a.body });
  } catch {
    // повредени стари данни — няма какво да пренесем
  }

  const trySync = () => {
    if (navigator.onLine) void syncPending();
  };
  window.addEventListener("online", trySync);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") trySync();
  });
  void q.pending().then((p) => {
    setCount(p.length);
    if (p.length > 0) trySync();
  });
}

// ─── Кеш на обходите (за отваряне без връзка) ─────────────────────────────

type Cached<T> = { data: T; savedAt: string };

export async function cacheGet<T>(key: string): Promise<Cached<T> | undefined> {
  try {
    return await getStore().get<Cached<T>>(`cache:${key}`);
  } catch {
    return undefined;
  }
}

export async function cacheSet<T>(key: string, data: T): Promise<void> {
  try {
    await getStore().set(`cache:${key}`, { data, savedAt: new Date().toISOString() });
  } catch {
    // кешът е удобство, не е задължителен
  }
}

export const jobCacheKey = (jobId: string) => `job:${jobId}`;
export const JOBS_CACHE_KEY = "jobs";

type AnyItem = { id: string; done?: boolean | null; photos?: unknown[]; [k: string]: unknown };
type AnyDetail = { id: string; status?: string; items?: AnyItem[]; [k: string]: unknown };

/**
 * Успешно синхронизираното влиза в кеша на обхода веднага — така снимката
 * не "премигва" между излизането от опашката и следващото зареждане, а
 * офлайн отвореният обход показва реалното състояние.
 */
async function patchCacheAfterSync(action: QueuedAction, data: unknown) {
  if (!action.jobId) return;
  const key = jobCacheKey(action.jobId);
  const cached = await cacheGet<AnyDetail>(key);
  if (!cached) return;
  const d: AnyDetail = { ...cached.data, items: (cached.data.items ?? []).map((i) => ({ ...i })) };
  const r = (data ?? {}) as Record<string, unknown>;

  switch (action.kind) {
    case "photo": {
      const photo = { id: r.id, storage_path: r.storage_path, taken_at: r.taken_at };
      const item = d.items!.find((i) => i.id === action.itemId);
      if (item) item.photos = [...(item.photos ?? []), photo];
      break;
    }
    case "tick": {
      const item = d.items!.find((i) => i.id === action.itemId);
      if (item) item.done = action.done;
      break;
    }
    case "start": {
      d.status = "in_progress";
      if (Array.isArray(r.items)) {
        d.items = (r.items as Record<string, unknown>[]).map((i) => ({
          id: String(i.id),
          label: i.label,
          zone_label: i.zone_label ?? null,
          done: Boolean(i.done),
          required: i.required ?? null,
          evidence_type: i.proof_type ?? null,
          photos: [],
        }));
      }
      break;
    }
    case "complete":
      d.status = "completed";
      break;
    case "cancel":
      d.status = "cancelled";
      break;
    default:
      return;
  }
  await cacheSet(key, d);
}

export function isOnline(): boolean {
  return !isBrowser() || navigator.onLine !== false;
}
