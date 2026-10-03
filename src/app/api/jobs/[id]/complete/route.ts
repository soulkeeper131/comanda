import { db } from "@/db";
import { jobs, jobItems, properties, evidence, overrides, findings } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { notify, propertyLink } from "@/lib/messages";
import { withAuth, canCompleteJobItem } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const POST = withAuth({ role: ["admin", "inspector"] }, async (_request, { session, params }) => {
  try {
    const { id } = params;

    // Get the job
    const job = db.select().from(jobs).where(eq(jobs.id, id)).get();
    if (!job) {
      return NextResponse.json({ error: "Задачата не е намерена" }, { status: 404 });
    }

    if (!canCompleteJobItem(session, job)) {
      return NextResponse.json({ error: "Обходът не е възложен на вас" }, { status: 403 });
    }

    if (job.status !== "in_progress") {
      return NextResponse.json(
        { error: "Само задача в прогрес може да бъде завършена" },
        { status: 400 }
      );
    }

    // Get all required items that are NOT done
    const undoneRequired = db
      .select()
      .from(jobItems)
      .where(
        and(
          eq(jobItems.job_id, id),
          eq(jobItems.required, true),
          eq(jobItems.done, false)
        )
      )
      .all();

    if (undoneRequired.length > 0) {
      return NextResponse.json(
        {
          error: "Не всички задължителни стъпки са изпълнени",
          undone_items: undoneRequired.map((item) => ({
            id: item.id,
            label: item.label,
            zone_label: item.zone_label,
          })),
        },
        { status: 400 }
      );
    }

    // Всички стъпки са отметнати, но „отметнато" не значи „доказано" — снимкова
    // стъпка трябва да има качена снимка ИЛИ записано админско прескачане
    // (overrides). Без тази проверка данните биха могли да бъдат подправени
    // директно, или снимка да бъде изтрита след отмятането, без забележка.
    const requiredPhotoItems = db
      .select()
      .from(jobItems)
      .where(
        and(
          eq(jobItems.job_id, id),
          eq(jobItems.required, true),
          eq(jobItems.proof_type, "photo"),
        )
      )
      .all();

    if (requiredPhotoItems.length > 0) {
      const itemIds = requiredPhotoItems.map((item) => item.id);

      const evidenceRows = db
        .select({ job_item_id: evidence.job_item_id })
        .from(evidence)
        .where(inArray(evidence.job_item_id, itemIds))
        .all();
      const itemsWithEvidence = new Set(evidenceRows.map((r) => r.job_item_id));

      const overrideRows = db
        .select({ entity_id: overrides.entity_id })
        .from(overrides)
        .where(and(eq(overrides.entity_type, "job_item"), inArray(overrides.entity_id, itemIds)))
        .all();
      const itemsWithOverride = new Set(overrideRows.map((r) => r.entity_id));

      const missingProof = requiredPhotoItems.filter(
        (item) => !itemsWithEvidence.has(item.id) && !itemsWithOverride.has(item.id)
      );

      if (missingProof.length > 0) {
        return NextResponse.json(
          {
            error: "Липсва доказателство (снимка) за задължителни стъпки",
            missing_evidence_items: missingProof.map((item) => ({
              id: item.id,
              label: item.label,
              zone_label: item.zone_label,
            })),
          },
          { status: 400 }
        );
      }
    }

    // All required items done — complete the job
    const now = new Date().toISOString();
    db.update(jobs)
      .set({ status: "completed", check_out: now })
      .where(eq(jobs.id, id))
      .run();

    const updatedJob = db.select().from(jobs).where(eq(jobs.id, id)).get();
    const items = db.select().from(jobItems).where(eq(jobItems.job_id, id)).all();

    // Клиентът: обходът е готов — колко е проверено, колко снимки, какво е
    // отбелязано. Екипът вижда завършения обход в приложението (без имейл).
    const prop = db.select({ name: properties.name, owner_id: properties.owner_id }).from(properties).where(eq(properties.id, job.property_id)).get();
    if (prop) {
      const photos = db.select({ id: evidence.id }).from(evidence).where(eq(evidence.job_id, id)).all().length;
      const found = db.select({ title: findings.title, severity: findings.severity }).from(findings).where(eq(findings.job_id, id)).all();
      await notify("visit_done", {
        to: prop.owner_id,
        vars: {
          property: prop.name,
          done: items.filter((i) => i.done).length,
          total: items.length,
          photos,
        },
        rows: [
          ["Отбелязани проблеми", found.length ? found.map((f) => `${f.title}${f.severity === "urgent" ? " (спешно)" : ""}`).join("; ") : "няма"],
        ],
        link: propertyLink(job.property_id),
      });
    }

    return NextResponse.json({ ...updatedJob, items });
  } catch (error) {
    console.error("POST /api/jobs/[id]/complete error:", error);
    return NextResponse.json({ error: "Грешка при завършване на задача" }, { status: 500 });
  }
});
