import { describe, it, expect, vi } from "vitest";
import { createOfflineQueue, createMemoryStore, type FetchLike } from "./offline-queue";

type Call = { method: string; url: string; body: unknown };
type Reply = { status: number; body?: unknown } | "throw";

/** Фалшив fetch: записва заявките и отговаря по функция. */
function fakeFetch(reply: (c: Call, n: number) => Reply) {
  const calls: Call[] = [];
  let uploads = 0;
  const fn: FetchLike = async (url, init) => {
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body instanceof FormData ? "form" : undefined;
    const call = { method, url, body };
    calls.push(call);
    const r = reply(call, calls.length);
    if (r === "throw") throw new TypeError("Failed to fetch");
    let payload = r.body;
    if (payload === undefined && url === "/api/upload" && r.status < 300) payload = { id: `up-${++uploads}.jpg` };
    return new Response(JSON.stringify(payload ?? {}), { status: r.status });
  };
  return { fn, calls };
}

let t = 0;
function setup(reply: (c: Call, n: number) => Reply) {
  const store = createMemoryStore();
  const f = fakeFetch(reply);
  let id = 0;
  const onChange = vi.fn();
  const q = createOfflineQueue({
    store,
    fetch: f.fn,
    now: () => new Date(Date.UTC(2026, 9, 1, 10, 0, t++)),
    uuid: () => `id${++id}`,
    onChange,
  });
  return { q, store, calls: f.calls, onChange };
}

const blob = () => new Blob(["img"], { type: "image/jpeg" });
const ok = (): Reply => ({ status: 200 });

describe("офлайн опашка", () => {
  it("качва снимката, после evidence, после отметката — с времето и GPS от момента на действието", async () => {
    const { q, calls } = setup(ok);
    await q.enqueuePhoto({ jobId: "j1", itemId: "i1", blob: blob(), lat: 42.1, lng: 23.3, label: "Снимка" });
    await q.enqueueTick({ jobId: "j1", itemId: "i1", done: true, label: "Отметка" });

    const res = await q.sync();
    expect(res).toMatchObject({ synced: 2, rejected: 0, remaining: 0, halted: false });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST /api/upload",
      "POST /api/evidence",
      "PATCH /api/job-items/i1",
    ]);
    expect(calls[1].body).toMatchObject({
      job_id: "j1",
      job_item_id: "i1",
      storage_path: "up-1.jpg",
      lat: 42.1,
      lng: 23.3,
      client_taken_at: "2026-10-01T10:00:00.000Z",
    });
    // Времето е от добавянето в опашката, не от синхронизацията.
    expect((calls[2].body as { client_at: string }).client_at < new Date(Date.UTC(2026, 9, 1, 10, 0, t)).toISOString()).toBe(true);
  });

  it("отхвърлено качване → зависимата отметка НЕ се праща и е в отхвърлените с причина", async () => {
    const { q, calls } = setup((c) => (c.url === "/api/upload" ? { status: 400, body: { error: "Файлът е твърде голям" } } : ok()));
    await q.enqueuePhoto({ jobId: "j1", itemId: "i1", blob: blob(), lat: null, lng: null, label: "Снимка към „Мивка“" });
    await q.enqueueTick({ jobId: "j1", itemId: "i1", done: true, label: "Отметка „Мивка“" });
    await q.enqueueTick({ jobId: "j1", itemId: "i2", done: true, label: "Отметка „Под“" });

    const res = await q.sync();
    expect(res).toMatchObject({ synced: 1, rejected: 2, remaining: 0 });
    expect(calls.map((c) => c.url)).toEqual(["/api/upload", "/api/job-items/i2"]);
    const rej = await q.rejected();
    expect(rej.map((r) => r.action.label)).toEqual(["Снимка към „Мивка“", "Отметка „Мивка“"]);
    expect(rej[0].reason).toBe("Файлът е твърде голям");
    expect(rej[1].reason).toContain("Снимка към „Мивка“");
  });

  it("отхвърлено evidence (напр. обходът не тече) също спира отметката", async () => {
    const { q, calls } = setup((c) =>
      c.url === "/api/evidence" ? { status: 400, body: { error: "Снимки се добавят само докато обходът тече" } } : ok(),
    );
    await q.enqueuePhoto({ jobId: "j1", itemId: "i1", blob: blob(), lat: null, lng: null, label: "Снимка" });
    await q.enqueueTick({ jobId: "j1", itemId: "i1", done: true, label: "Отметка" });
    await q.sync();
    expect(calls.some((c) => c.url.startsWith("/api/job-items"))).toBe(false);
    expect((await q.rejected()).length).toBe(2);
  });

  it("мрежова грешка спира синхронизацията и пази реда; качената снимка не се качва повторно", async () => {
    let offline = true;
    const { q, calls } = setup((c) => (c.url === "/api/evidence" && offline ? "throw" : ok()));
    await q.enqueuePhoto({ jobId: "j1", itemId: "i1", blob: blob(), lat: null, lng: null, label: "Снимка" });
    await q.enqueueTick({ jobId: "j1", itemId: "i1", done: true, label: "Отметка" });

    const first = await q.sync();
    expect(first).toMatchObject({ synced: 0, rejected: 0, remaining: 2, halted: true });
    expect(calls.map((c) => c.url)).toEqual(["/api/upload", "/api/evidence"]);

    offline = false;
    const second = await q.sync();
    expect(second).toMatchObject({ synced: 2, remaining: 0 });
    expect(calls.filter((c) => c.url === "/api/upload")).toHaveLength(1);
    expect(calls[2].body).toMatchObject({ storage_path: "up-1.jpg" });
  });

  it("повторен опит за evidence праща същия client_id (без дубликат на сървъра)", async () => {
    let n = 0;
    const { q, calls } = setup((c) => {
      if (c.url !== "/api/evidence") return ok();
      n++;
      // 1-ви: записано, но отговорът се губи; 2-ри: сървърът връща съществуващия с 200.
      return n === 1 ? "throw" : { status: 200, body: { id: "ev1" } };
    });
    await q.enqueuePhoto({ jobId: "j1", itemId: "i1", blob: blob(), lat: null, lng: null, label: "Снимка" });
    expect(await q.sync()).toMatchObject({ synced: 0, remaining: 1, halted: true });
    expect(await q.sync()).toMatchObject({ synced: 1, remaining: 0 });
    const ev = calls.filter((c) => c.url === "/api/evidence").map((c) => (c.body as { client_id: string }).client_id);
    expect(ev).toHaveLength(2);
    expect(ev[0]).toBeTruthy();
    expect(ev[1]).toBe(ev[0]);
  });

  it("констатацията има client_id; 201 е успех", async () => {
    const { q, calls } = setup((c) => (c.url === "/api/findings" ? { status: 201, body: { id: "f1" } } : ok()));
    await q.enqueueFinding({ jobId: "j1", itemId: null, title: "Теч", body: "", severity: "normal", blobs: [] });
    expect(await q.sync()).toMatchObject({ synced: 1, remaining: 0 });
    expect((calls[0].body as { client_id: string }).client_id).toBeTruthy();
  });

  it("5xx и 401 остават в опашката, не се броят за синхронизирани", async () => {
    let status = 503;
    const { q } = setup(() => ({ status }));
    await q.enqueueTick({ jobId: "j1", itemId: "i1", done: false, label: "Отметка" });
    expect(await q.sync()).toMatchObject({ synced: 0, remaining: 1, halted: true });
    status = 401;
    expect(await q.sync()).toMatchObject({ synced: 0, remaining: 1, halted: true });
    expect(await q.rejected()).toEqual([]);
    status = 200;
    expect(await q.sync()).toMatchObject({ synced: 1, remaining: 0 });
  });

  it("отметка без снимка, отказана от сървъра, отива в отхвърлените — не изчезва", async () => {
    const { q } = setup(() => ({ status: 400, body: { error: "Стъпката изисква снимка" } }));
    await q.enqueueTick({ jobId: "j1", itemId: "i1", done: true, label: "Отметка" });
    for (let i = 0; i < 5; i++) await q.sync();
    const rej = await q.rejected();
    expect(rej).toHaveLength(1);
    expect(rej[0]).toMatchObject({ reason: "Стъпката изисква снимка", status: 400 });
  });

  it("завършването върви последно и 400 показва липсващите стъпки", async () => {
    const { q, calls } = setup((c) =>
      c.url.endsWith("/complete")
        ? {
            status: 400,
            body: {
              error: "Липсва доказателство (снимка) за задължителни стъпки",
              missing_evidence_items: [{ id: "i2", label: "Бойлер" }],
            },
          }
        : ok(),
    );
    await q.enqueueTick({ jobId: "j1", itemId: "i1", done: true, label: "Отметка" });
    await q.enqueueComplete({ jobId: "j1" });
    await q.sync();
    expect(calls.map((c) => c.url)).toEqual(["/api/job-items/i1", "/api/jobs/j1/complete"]);
    const [r] = await q.rejected();
    expect(r.action.kind).toBe("complete");
    expect(r.details).toEqual(["Бойлер"]);
  });

  it("отхвърлено завършване, ако зависима снимка е отхвърлена", async () => {
    const { q, calls } = setup((c) => (c.url === "/api/upload" ? { status: 400, body: { error: "Лош файл" } } : ok()));
    await q.enqueuePhoto({ jobId: "j1", itemId: "i1", blob: blob(), lat: null, lng: null, label: "Снимка" });
    await q.enqueueComplete({ jobId: "j1" });
    await q.sync();
    expect(calls.some((c) => c.url.endsWith("/complete"))).toBe(false);
    expect((await q.rejected()).map((r) => r.action.kind)).toEqual(["photo", "complete"]);
  });

  it("офлайн старт с координати и време; отказан геофенсинг отхвърля всичко по обхода", async () => {
    const { q, calls } = setup((c) =>
      c.url.endsWith("/start") ? { status: 403, body: { error: "Намирате се на 900 м от имота.", distance_m: 900 } } : ok(),
    );
    await q.enqueueStart({ jobId: "j1", lat: 42, lng: 23 });
    await q.enqueueCancel({ jobId: "j1", reason: "Няма достъп до имота" });
    await q.enqueueTick({ jobId: "j2", itemId: "x", done: false, label: "Друг обход" });
    await q.sync();
    expect(calls[0].body).toMatchObject({ lat: 42, lng: 23 });
    expect((calls[0].body as { client_at: string }).client_at).toMatch(/^2026-10-01T10:00:/);
    expect(calls.map((c) => c.url)).toEqual(["/api/jobs/j1/start", "/api/job-items/x"]);
    expect((await q.rejected()).map((r) => r.action.kind)).toEqual(["start", "cancel"]);
  });

  it("констатация със снимки: качва всички, после POST с photo_ids", async () => {
    const { q, calls } = setup(ok);
    await q.enqueueFinding({
      jobId: "j1",
      itemId: "i1",
      title: "Теч под мивката",
      body: "",
      severity: "urgent",
      blobs: [blob(), blob()],
    });
    await q.sync();
    expect(calls.map((c) => c.url)).toEqual(["/api/upload", "/api/upload", "/api/findings"]);
    expect(calls[2].body).toMatchObject({ severity: "urgent", photo_ids: ["up-1.jpg", "up-2.jpg"], job_item_id: "i1" });
  });

  it("„Разбрах“ маха отхвърленото и снимката му от устройството", async () => {
    const { q, store } = setup(() => ({ status: 400, body: { error: "Не" } }));
    const a = await q.enqueuePhoto({ jobId: "j1", itemId: "i1", blob: blob(), lat: null, lng: null, label: "Снимка" });
    await q.sync();
    const key = a.kind === "photo" ? a.blobKey : "";
    expect(store.data.has(key)).toBe(true);
    await q.dismissRejected(a.id);
    expect(await q.rejected()).toEqual([]);
    expect(store.data.has(key)).toBe(false);
  });

  it("успешната снимка изтрива Blob-а; едновременни sync() не дублират заявки", async () => {
    const { q, store, calls, onChange } = setup(ok);
    const a = await q.enqueuePhoto({ jobId: "j1", itemId: "i1", blob: blob(), lat: null, lng: null, label: "Снимка" });
    await Promise.all([q.sync(), q.sync()]);
    expect(calls).toHaveLength(2);
    expect(store.data.has(a.kind === "photo" ? a.blobKey : "")).toBe(false);
    expect(onChange).toHaveBeenCalled();
  });
});
