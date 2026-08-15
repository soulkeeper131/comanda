import { db } from "@/db";
import { jobs, templateItems, jobItems, properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { notifyOwner } from "@/lib/notifications";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const POST = withAuth({ role: ["admin", "inspector"] }, async (_request, { params }) => {
  try {
    const { id } = params;

    // Get the job
    const job = db.select().from(jobs).where(eq(jobs.id, id)).get();
    if (!job) {
      return NextResponse.json({ error: "Задачата не е намерена" }, { status: 404 });
    }

    if (!job.template_id) {
      return NextResponse.json(
        { error: "Задачата няма свързан шаблон" },
        { status: 400 }
      );
    }

    if (job.status !== "planned") {
      return NextResponse.json(
        { error: "Задачата може да бъде стартирана само от статус 'planned'" },
        { status: 400 }
      );
    }

    // Check if job already has items (prevent double-start)
    const existingItems = db
      .select()
      .from(jobItems)
      .where(eq(jobItems.job_id, id))
      .all();

    if (existingItems.length > 0) {
      return NextResponse.json(
        { error: "Задачата вече е стартирана и има налични стъпки" },
        { status: 400 }
      );
    }

    // Get template items
    const items = db
      .select()
      .from(templateItems)
      .where(eq(templateItems.template_id, job.template_id))
      .all();

    if (items.length === 0) {
      return NextResponse.json(
        { error: "Шаблонът няма дефинирани стъпки" },
        { status: 400 }
      );
    }

    // Copy template items to job items
    const now = new Date().toISOString();
    for (const item of items) {
      db.insert(jobItems).values({
        job_id: id,
        zone_label: item.zone_label,
        label: item.label,
        proof_type: item.proof_type,
        required: item.required ?? true,
        sort: item.sort,
        done: false,
      }).run();
    }

    // Update job status to in_progress and set check_in
    db.update(jobs)
      .set({ status: "in_progress", check_in: now })
      .where(eq(jobs.id, id))
      .run();

    // Return updated job with items
    const updatedJob = db.select().from(jobs).where(eq(jobs.id, id)).get();
    const updatedItems = db.select().from(jobItems).where(eq(jobItems.job_id, id)).all();

    // Notify property owner about started job
    const prop = db.select({ name: properties.name }).from(properties).where(eq(properties.id, job.property_id)).get();
    notifyOwner(
      job.property_id,
      "job_started",
      "🔧 Започнат обход",
      `${job.title || "Обход"} — ${prop?.name || "Имот"}`,
      "/dashboard",
    );

    return NextResponse.json({ ...updatedJob, items: updatedItems });
  } catch (error) {
    console.error("POST /api/jobs/[id]/start error:", error);
    return NextResponse.json({ error: "Грешка при стартиране на задача" }, { status: 500 });
  }
});
