import { db } from "@/db";
import { jobItems, jobs, evidence } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAuth, canCompleteJobItem, isAdmin } from "@/lib/auth";
import { canMarkItemDone } from "@/lib/domain/jobs";
import { recordOverride } from "@/lib/domain/overrides";

export const dynamic = "force-dynamic";

export const PATCH = withAuth({ role: ["admin", "inspector"] }, async (request, { session, params }) => {
  try {
    const { id } = params;
    const body = await request.json();
    const { done, override_reason } = body;

    if (done === undefined) {
      return NextResponse.json(
        { error: "Полето 'done' е задължително" },
        { status: 400 }
      );
    }

    // Check if job item exists
    const item = db.select().from(jobItems).where(eq(jobItems.id, id)).get();
    if (!item) {
      return NextResponse.json({ error: "Стъпката не е намерена" }, { status: 404 });
    }

    const job = db.select().from(jobs).where(eq(jobs.id, item.job_id)).get();
    if (!job || !canCompleteJobItem(session, job)) {
      return NextResponse.json({ error: "Нямате права за тази стъпка" }, { status: 403 });
    }

    // Стъпки се пипат само докато обходът тече. Отказана или завършена задача
    // е приключила — иначе "отказан обход" не е наистина спрян и историята му
    // може да се дописва след факта.
    if (job.status !== "in_progress") {
      const label =
        job.status === "cancelled"
          ? "отказана"
          : job.status === "completed"
            ? "завършена"
            : "нестартирана";
      return NextResponse.json(
        { error: `Задачата е ${label} — стъпките ѝ не могат да се променят.` },
        { status: 400 },
      );
    }

    // Размаркирането (done: false) не твърди, че работата е свършена — не
    // изисква снимка и не се одитира. Проверката важи само при отмятане.
    if (done) {
      const photo = db.select().from(evidence).where(eq(evidence.job_item_id, item.id)).get();
      const verdict = canMarkItemDone(item, {
        hasEvidence: Boolean(photo),
        isAdmin: isAdmin(session),
        reason: override_reason ?? null,
      });

      if (!verdict.ok) {
        return NextResponse.json({ error: verdict.error }, { status: 400 });
      }

      db.update(jobItems).set({ done: true }).where(eq(jobItems.id, id)).run();

      // Отмятането е сигурно — чак сега записваме прескачането, ако е имало.
      if (!photo && item.proof_type === "photo") {
        recordOverride({
          admin_id: session.uid,
          entity_type: "job_item",
          entity_id: item.id,
          reason: override_reason,
        });
      }
    } else {
      db.update(jobItems).set({ done: false }).where(eq(jobItems.id, id)).run();
    }

    const updated = db.select().from(jobItems).where(eq(jobItems.id, id)).get();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/job-items/[id] error:", error);
    return NextResponse.json({ error: "Грешка при обновяване на стъпка" }, { status: 500 });
  }
});
