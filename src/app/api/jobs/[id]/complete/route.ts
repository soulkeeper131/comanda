import { db } from "@/db";
import { jobs, jobItems } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Get the job
    const job = db.select().from(jobs).where(eq(jobs.id, id)).get();
    if (!job) {
      return NextResponse.json({ error: "Задачата не е намерена" }, { status: 404 });
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

    // All required items done — complete the job
    const now = new Date().toISOString();
    db.update(jobs)
      .set({ status: "completed", check_out: now })
      .where(eq(jobs.id, id))
      .run();

    const updatedJob = db.select().from(jobs).where(eq(jobs.id, id)).get();
    const items = db.select().from(jobItems).where(eq(jobItems.job_id, id)).all();

    return NextResponse.json({ ...updatedJob, items });
  } catch (error) {
    console.error("POST /api/jobs/[id]/complete error:", error);
    return NextResponse.json({ error: "Грешка при завършване на задача" }, { status: 500 });
  }
}
