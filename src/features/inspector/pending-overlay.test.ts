import { describe, it, expect } from "vitest";
import { applyPending, pendingFlags } from "./pending-overlay";
import type { QueuedAction } from "@/lib/offline-queue";
import type { JobDetail } from "./types";
import { dayKey, formatTime } from "./format";

const detail: JobDetail = {
  id: "j1",
  title: "Обход",
  status: "in_progress",
  planned_at: "2026-10-01",
  property_id: "p1",
  items: [{ id: "i1", label: "Мивка", zone_label: null, done: false, required: true, evidence_type: "photo", photos: [] }],
  photos: [],
};

const base = { label: "x", createdAt: "2026-10-01T10:00:00Z", dependsOn: [] };

describe("чакащи действия върху обхода", () => {
  it("показва офлайн снимката и отметката, докато чакат", () => {
    const pending: QueuedAction[] = [
      { ...base, id: "a1", kind: "photo", jobId: "j1", itemId: "i1", blobKey: "blob:1", lat: null, lng: null, clientAt: "t", clientId: "c1" },
      { ...base, id: "a2", kind: "tick", jobId: "j1", itemId: "i1", done: true, clientAt: "t" },
      { ...base, id: "a3", kind: "complete", jobId: "j1", clientAt: "t" },
    ];
    const view = applyPending(detail, pending);
    expect(view.items[0].photos[0].localBlobKey).toBe("blob:1");
    expect(view.items[0].done).toBe(true);
    expect(view.items[0].pendingTick).toBe(true);
    expect(detail.items[0].done).toBe(false); // оригиналът не се пипа
    expect(pendingFlags("j1", pending)).toMatchObject({ complete: true, start: false, count: 3 });
  });

  it("без чакащи (отхвърлено → извадено от опашката) състоянието се връща", () => {
    expect(applyPending(detail, []).items[0].done).toBe(false);
  });

  it("само дата не се чете като UTC полунощ и няма час", () => {
    expect(dayKey("2026-10-01")).toBe("2026-10-01");
    expect(formatTime("2026-10-01")).toBe("");
  });
});
