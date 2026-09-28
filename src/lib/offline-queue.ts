// Офлайн опашка за инспектора (N2) — без React и без браузърни API, за да
// се тества. fetch и хранилището се подават отвън (IndexedDB в браузъра,
// Map в тестовете).
//
// Правилата (въпрос 16 от въпросника):
//  1. Координатите и времето се записват в момента на действието
//     (client_at / client_taken_at, lat/lng), не при синхронизация.
//  2. Синхронизацията просто повтаря същите API заявки в същия ред —
//     сървърът прави всички проверки (геофенсинг, снимка преди отметка…).
//  3. Снимката се качва ПРЕДИ отметката: upload → evidence → tick. Ако
//     снимката бъде отхвърлена, зависимата отметка не се праща изобщо.
//  4. Отхвърлено действие (4xx) НЕ изчезва — отива в списък "отхвърлени" с
//     причината от сървъра. Мрежова грешка/5xx/401 → остава в опашката и
//     синхронизацията спира (редът е важен, не прескачаме напред).

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** Ключ-стойност хранилище. Стойностите могат да са Blob (IndexedDB го поддържа). */
export interface KVStore {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
}

type Base = {
  id: string;
  jobId: string | null;
  /** Човешко описание за списъка с отхвърлени ("Снимка към „Мивка“"). */
  label: string;
  createdAt: string;
  /** Действия, без които това няма смисъл (отхвърлено ли е някое → и това). */
  dependsOn: string[];
};

type Geo = { lat: number | null; lng: number | null };

export type StartAction = Base & Geo & { kind: "start"; jobId: string; clientAt: string };
export type PhotoAction = Base &
  Geo & {
    kind: "photo";
    jobId: string;
    itemId: string | null;
    blobKey: string;
    clientAt: string;
    /** Идемпотентен ключ за /api/evidence — същият при всеки повторен опит. */
    clientId: string;
    uploadedId?: string;
  };
export type TickAction = Base & { kind: "tick"; jobId: string; itemId: string; done: boolean; clientAt: string };
export type FindingAction = Base & {
  kind: "finding";
  jobId: string;
  /** Идемпотентен ключ за /api/findings — същият при всеки повторен опит. */
  clientId: string;
  itemId: string | null;
  title: string;
  body: string;
  severity: "normal" | "urgent";
  blobKeys: string[];
  uploadedIds: Record<string, string>;
  clientAt: string;
};
export type CompleteAction = Base & { kind: "complete"; jobId: string; clientAt: string };
export type CancelAction = Base & { kind: "cancel"; jobId: string; reason: string; clientAt: string };
/** Наследено от старата опашка (ChecklistSheet) — произволна JSON заявка. */
export type RawAction = Base & { kind: "raw"; method: string; url: string; body?: unknown };

export type QueuedAction =
  | StartAction
  | PhotoAction
  | TickAction
  | FindingAction
  | CompleteAction
  | CancelAction
  | RawAction;

export type RejectedAction = {
  action: QueuedAction;
  reason: string;
  /** Напр. стъпките без снимка при отказано завършване. */
  details: string[];
  status: number | null;
  rejectedAt: string;
};

export type SyncResult = { synced: number; rejected: number; remaining: number; halted: boolean };

export type QueueOptions = {
  store: KVStore;
  fetch: FetchLike;
  now?: () => Date;
  uuid?: () => string;
  /** След всяка промяна на опашката/отхвърлените. */
  onChange?: (state: { pending: QueuedAction[]; rejected: RejectedAction[] }) => void;
  /** Успешно действие — преди да излезе от опашката (напр. обнови кеша). */
  onSynced?: (action: QueuedAction, data: unknown) => void | Promise<void>;
};

const ACTIONS = "queue:actions";
const REJECTED = "queue:rejected";

type Outcome =
  | { kind: "ok"; data: unknown }
  | { kind: "retry" }
  | { kind: "reject"; status: number; reason: string; details: string[] };

/** 401 (изтекла сесия), 408, 429 и 5xx не са присъда за действието — опитай пак. */
export function isRetryableStatus(status: number): boolean {
  return status === 401 || status === 408 || status === 429 || status >= 500;
}

function labelsOf(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((i) => (i && typeof i === "object" && "label" in i ? String((i as { label: unknown }).label) : ""))
    .filter(Boolean);
}

async function send(fetchFn: FetchLike, url: string, init: RequestInit): Promise<Outcome> {
  let res: Response;
  try {
    res = await fetchFn(url, init);
  } catch {
    return { kind: "retry" };
  }
  const data: unknown = await res.json().catch(() => null);
  if (res.ok) return { kind: "ok", data };
  if (isRetryableStatus(res.status)) return { kind: "retry" };
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    kind: "reject",
    status: res.status,
    reason: typeof d.error === "string" && d.error ? d.error : `Сървърът отказа (${res.status}).`,
    details: [...labelsOf(d.missing_evidence_items), ...labelsOf(d.undone_items)],
  };
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

function extFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

export function createOfflineQueue(opts: QueueOptions) {
  const { store, fetch: fetchFn } = opts;
  const now = opts.now ?? (() => new Date());
  const uuid = opts.uuid ?? (() => crypto.randomUUID());

  // Всички четене-промяна-запис минават през една верига, за да не се
  // застъпят добавяне по време на синхронизация.
  let lock: Promise<unknown> = Promise.resolve();
  function mutate<T>(fn: (p: QueuedAction[], r: RejectedAction[]) => T | Promise<T>): Promise<T> {
    const run = lock.then(async () => {
      const pending = (await store.get<QueuedAction[]>(ACTIONS)) ?? [];
      const rejected = (await store.get<RejectedAction[]>(REJECTED)) ?? [];
      const result = await fn(pending, rejected);
      await store.set(ACTIONS, pending);
      await store.set(REJECTED, rejected);
      opts.onChange?.({ pending: [...pending], rejected: [...rejected] });
      return result;
    });
    lock = run.catch(() => undefined);
    return run;
  }

  async function pending(): Promise<QueuedAction[]> {
    await lock;
    return (await store.get<QueuedAction[]>(ACTIONS)) ?? [];
  }
  async function rejected(): Promise<RejectedAction[]> {
    await lock;
    return (await store.get<RejectedAction[]>(REJECTED)) ?? [];
  }

  function depsFor(list: QueuedAction[], jobId: string, pick: (a: QueuedAction) => boolean): string[] {
    return list.filter((a) => a.jobId === jobId && (a.kind === "start" || pick(a))).map((a) => a.id);
  }

  type NewAction = QueuedAction extends infer A
    ? A extends QueuedAction
      ? Omit<A, "id" | "createdAt" | "dependsOn">
      : never
    : never;

  function enqueue(input: NewAction, deps: (list: QueuedAction[]) => string[]): Promise<QueuedAction> {
    return mutate((list) => {
      const action = { ...input, id: uuid(), createdAt: now().toISOString(), dependsOn: deps(list) } as QueuedAction;
      list.push(action);
      return action;
    });
  }

  const at = () => now().toISOString();

  const api = {
    pending,
    rejected,

    getBlob: (key: string) => store.get<Blob>(key),

    enqueueStart(p: { jobId: string; lat: number | null; lng: number | null; label?: string; clientAt?: string }) {
      return enqueue(
        { kind: "start", jobId: p.jobId, lat: p.lat, lng: p.lng, clientAt: p.clientAt ?? at(), label: p.label ?? "Старт на обхода" },
        () => [],
      );
    },

    async enqueuePhoto(p: {
      jobId: string;
      itemId: string | null;
      blob: Blob;
      lat: number | null;
      lng: number | null;
      label: string;
      clientAt?: string;
    }) {
      const clientAt = p.clientAt ?? at();
      const blobKey = `blob:${uuid()}`;
      await store.set(blobKey, p.blob);
      return enqueue(
        {
          kind: "photo",
          jobId: p.jobId,
          itemId: p.itemId,
          blobKey,
          lat: p.lat,
          lng: p.lng,
          clientAt,
          clientId: uuid(),
          label: p.label,
        },
        (list) => depsFor(list, p.jobId, () => false),
      );
    },

    enqueueTick(p: { jobId: string; itemId: string; done: boolean; label: string; clientAt?: string }) {
      return enqueue(
        { kind: "tick", jobId: p.jobId, itemId: p.itemId, done: p.done, clientAt: p.clientAt ?? at(), label: p.label },
        // Отметката зависи от чакащите снимки към същата стъпка.
        (list) => depsFor(list, p.jobId, (a) => p.done && a.kind === "photo" && a.itemId === p.itemId),
      );
    },

    async enqueueFinding(p: {
      jobId: string;
      itemId: string | null;
      title: string;
      body: string;
      severity: "normal" | "urgent";
      blobs: Blob[];
      label?: string;
      clientAt?: string;
    }) {
      const clientAt = p.clientAt ?? at();
      const blobKeys: string[] = [];
      for (const b of p.blobs) {
        const key = `blob:${uuid()}`;
        await store.set(key, b);
        blobKeys.push(key);
      }
      return enqueue(
        {
          kind: "finding",
          jobId: p.jobId,
          clientId: uuid(),
          itemId: p.itemId,
          title: p.title,
          body: p.body,
          severity: p.severity,
          blobKeys,
          uploadedIds: {},
          clientAt,
          label: p.label ?? `Проблем „${p.title}“`,
        },
        (list) => depsFor(list, p.jobId, () => false),
      );
    },

    enqueueComplete(p: { jobId: string; label?: string }) {
      return enqueue(
        { kind: "complete", jobId: p.jobId, clientAt: at(), label: p.label ?? "Завършване на обхода" },
        (list) => depsFor(list, p.jobId, (a) => a.kind === "photo" || a.kind === "tick"),
      );
    },

    enqueueCancel(p: { jobId: string; reason: string; label?: string }) {
      return enqueue(
        { kind: "cancel", jobId: p.jobId, reason: p.reason, clientAt: at(), label: p.label ?? "Отказ на обхода" },
        (list) => depsFor(list, p.jobId, () => false),
      );
    },

    enqueueRaw(p: { method: string; url: string; body?: unknown; label?: string }) {
      return enqueue(
        { kind: "raw", jobId: null, method: p.method, url: p.url, body: p.body, label: p.label ?? `${p.method} ${p.url}` },
        () => [],
      );
    },

    /** "Разбрах" — махаме отхвърленото от списъка и снимките му от устройството. */
    async dismissRejected(actionId?: string) {
      const removed = await mutate((_p, r) => {
        const out = r.filter((x) => actionId === undefined || x.action.id === actionId);
        const keep = r.filter((x) => !(actionId === undefined || x.action.id === actionId));
        r.splice(0, r.length, ...keep);
        return out;
      });
      for (const x of removed) await dropBlobs(x.action);
    },

    sync,
  };

  async function dropBlobs(a: QueuedAction) {
    const keys = a.kind === "photo" ? [a.blobKey] : a.kind === "finding" ? a.blobKeys : [];
    for (const k of keys) await store.del(k).catch(() => undefined);
  }

  async function upload(blobKey: string, name: string): Promise<Outcome> {
    const blob = await store.get<Blob>(blobKey);
    if (!blob) return { kind: "reject", status: 0, reason: "Снимката липсва от устройството.", details: [] };
    const fd = new FormData();
    fd.append("file", blob, `${name}.${extFor(blob.type)}`);
    return send(fetchFn, "/api/upload", { method: "POST", body: fd });
  }

  function patchAction(id: string, patch: { uploadedId?: string; uploadedIds?: Record<string, string> }) {
    return mutate((list) => {
      const a = list.find((x) => x.id === id);
      if (a) Object.assign(a, patch);
    });
  }

  async function run(a: QueuedAction): Promise<Outcome> {
    switch (a.kind) {
      case "start":
        return send(fetchFn, `/api/jobs/${a.jobId}/start`, json("POST", { lat: a.lat, lng: a.lng, client_at: a.clientAt }));
      case "tick":
        return send(fetchFn, `/api/job-items/${a.itemId}`, json("PATCH", { done: a.done, client_at: a.clientAt }));
      case "complete":
        return send(fetchFn, `/api/jobs/${a.jobId}/complete`, json("POST", {}));
      case "cancel":
        return send(fetchFn, `/api/jobs/${a.jobId}/cancel`, json("POST", { reason: a.reason }));
      case "raw":
        return send(fetchFn, a.url, json(a.method, a.body));
      case "photo": {
        let uploadedId = a.uploadedId;
        if (!uploadedId) {
          const up = await upload(a.blobKey, a.id);
          if (up.kind !== "ok") return up;
          uploadedId = String((up.data as { id?: unknown })?.id ?? "");
          // Записваме веднага — при прекъсване след това не качваме повторно.
          await patchAction(a.id, { uploadedId });
        }
        return send(
          fetchFn,
          "/api/evidence",
          json("POST", {
            client_id: a.clientId,
            job_id: a.jobId,
            job_item_id: a.itemId,
            storage_path: uploadedId,
            lat: a.lat ?? undefined,
            lng: a.lng ?? undefined,
            client_taken_at: a.clientAt,
          }),
        );
      }
      case "finding": {
        const uploaded = { ...a.uploadedIds };
        for (const key of a.blobKeys) {
          if (uploaded[key]) continue;
          const up = await upload(key, `${a.id}-${a.blobKeys.indexOf(key)}`);
          if (up.kind !== "ok") return up;
          uploaded[key] = String((up.data as { id?: unknown })?.id ?? "");
          await patchAction(a.id, { uploadedIds: { ...uploaded } });
        }
        return send(
          fetchFn,
          "/api/findings",
          json("POST", {
            client_id: a.clientId,
            job_id: a.jobId,
            job_item_id: a.itemId ?? undefined,
            title: a.title,
            body: a.body,
            severity: a.severity,
            photo_ids: a.blobKeys.map((k) => uploaded[k]).filter(Boolean),
          }),
        );
      }
    }
  }

  /** Отхвърля действието и всички чакащи, които (преходно) зависят от него. */
  function rejectCascade(list: QueuedAction[], rej: RejectedAction[], head: QueuedAction, o: { status: number; reason: string; details: string[] }) {
    const when = at();
    const dead = new Set([head.id]);
    const out: RejectedAction[] = [{ action: head, reason: o.reason, details: o.details, status: o.status || null, rejectedAt: when }];
    for (const a of list) {
      if (a.id === head.id) continue;
      if (a.dependsOn.some((d) => dead.has(d))) {
        dead.add(a.id);
        out.push({
          action: a,
          reason: `Не е изпратено, защото „${head.label}“ беше отхвърлено: ${o.reason}`,
          details: [],
          status: null,
          rejectedAt: when,
        });
      }
    }
    const keep = list.filter((a) => !dead.has(a.id));
    list.splice(0, list.length, ...keep);
    rej.push(...out);
    return out.length;
  }

  let running: Promise<SyncResult> | null = null;

  function sync(): Promise<SyncResult> {
    if (running) return running;
    running = (async () => {
      let synced = 0;
      let rejectedCount = 0;
      let halted = false;
      for (;;) {
        const head = (await pending())[0];
        if (!head) break;
        const outcome = await run(head);
        if (outcome.kind === "retry") {
          halted = true;
          break;
        }
        if (outcome.kind === "ok") {
          await opts.onSynced?.(head, outcome.data);
          await mutate((list) => {
            const i = list.findIndex((x) => x.id === head.id);
            if (i >= 0) list.splice(i, 1);
          });
          await dropBlobs(head);
          synced++;
        } else {
          rejectedCount += await mutate((list, rej) => rejectCascade(list, rej, head, outcome));
        }
      }
      const remaining = (await pending()).length;
      return { synced, rejected: rejectedCount, remaining, halted };
    })().finally(() => {
      running = null;
    });
    return running;
  }

  return api;
}

export type OfflineQueue = ReturnType<typeof createOfflineQueue>;

/** Хранилище в паметта — за тестове и като резерва без IndexedDB. */
export function createMemoryStore(): KVStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    async get<T>(key: string) {
      const v = data.get(key);
      // Копие, за да не споделяме референции като истинско хранилище.
      return (v instanceof Blob || v === undefined ? v : structuredClone(v)) as T | undefined;
    },
    async set(key, value) {
      data.set(key, value instanceof Blob ? value : structuredClone(value));
    },
    async del(key) {
      data.delete(key);
    },
  };
}
