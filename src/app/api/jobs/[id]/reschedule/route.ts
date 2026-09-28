import { db } from "@/db";
import { jobs, properties, jobReschedules } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAuth, isAdmin } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { todaySofia } from "@/lib/jobs-generator";
import { canReschedule } from "@/lib/domain/reschedule";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/jobs/[id]/reschedule — клиентът мести обход сам (въпрос 11).
 * Body: { date: "YYYY-MM-DD" }
 *
 * Само планиран обход, не назад и не по-късно от 14 дни напред (админът —
 * без горна граница). Инспекторът получава известие, преместването се пази.
 */
export const PATCH = withAuth({ role: ["admin", "client"] }, async (request, { session, params }) => {
  try {
    const job = db.select().from(jobs).where(eq(jobs.id, params.id)).get();
    const property = job && db.select().from(properties).where(eq(properties.id, job.property_id)).get();
    if (!job || !property || (!isAdmin(session) && property.owner_id !== session.uid)) {
      return NextResponse.json({ error: "Обходът не е намерен" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const to = typeof body.date === "string" ? body.date.slice(0, 10) : "";
    const verdict = canReschedule({
      status: job.status ?? "planned",
      to,
      today: todaySofia(),
      isAdmin: isAdmin(session),
    });
    if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: 400 });

    const from = job.planned_at;
    if (from.slice(0, 10) === to) return NextResponse.json(job);

    const now = new Date().toISOString();
    db.transaction((tx) => {
      tx.insert(jobReschedules).values({ job_id: job.id, user_id: session.uid, from_date: from, to_date: to }).run();
      tx.update(jobs)
        .set({ planned_at: to, rescheduled_at: now, rescheduled_by: session.uid, rescheduled_from: from })
        .where(eq(jobs.id, job.id))
        .run();
    });

    const label = (d: string) => new Date(d.slice(0, 10) + "T12:00:00").toLocaleDateString("bg-BG");
    if (job.assignee_id) {
      createNotification(
        job.assignee_id,
        "job_rescheduled",
        "Обход е преместен",
        `${property.name}: ${label(from)} → ${label(to)}`,
        "/dashboard",
      );
    }
    if (isAdmin(session)) {
      createNotification(property.owner_id, "job_rescheduled", "Обходът е преместен", `${property.name}: ${label(to)}`, "/dashboard");
    }

    return NextResponse.json(db.select().from(jobs).where(eq(jobs.id, job.id)).get());
  } catch (error) {
    console.error("PATCH /api/jobs/[id]/reschedule error:", error);
    return NextResponse.json({ error: "Грешка при преместване" }, { status: 500 });
  }
});
