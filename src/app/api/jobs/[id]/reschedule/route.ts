import { db } from "@/db";
import { jobs, properties, jobReschedules, plans } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAuth, isAdmin } from "@/lib/auth";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { todaySofia } from "@/lib/jobs-generator";
import { canReschedule, rescheduleWindow } from "@/lib/domain/reschedule";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/jobs/[id]/reschedule — клиентът мести обход сам (въпрос 11).
 * Body: { date: "YYYY-MM-DD" }
 *
 * Само планиран обход, не назад и не по-късно от 14 дни напред (админът —
 * без горна граница). Инспекторът получава известие, преместването се пази.
 */
/** Всичко, от което зависи къде може да отиде обходът. */
function context(jobId: string) {
  const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get();
  if (!job) return null;
  const property = db.select().from(properties).where(eq(properties.id, job.property_id)).get();
  const firstMove = db
    .select({ from_date: jobReschedules.from_date })
    .from(jobReschedules)
    .where(eq(jobReschedules.job_id, job.id))
    .orderBy(asc(jobReschedules.created_at))
    .get();
  const plan = job.plan_id ? db.select().from(plans).where(eq(plans.id, job.plan_id)).get() : undefined;
  const current = job.planned_at.slice(0, 10);
  // Съседите от същия абонамент и същата услуга (ядро и добавка са отделни потоци).
  const siblings = job.plan_id
    ? db
        .select({ planned_at: jobs.planned_at, template_id: jobs.template_id, id: jobs.id, status: jobs.status })
        .from(jobs)
        .where(eq(jobs.plan_id, job.plan_id))
        .all()
        .filter((j) => j.id !== job.id && j.template_id === job.template_id && j.status !== "cancelled")
        .map((j) => j.planned_at.slice(0, 10))
    : [];
  const prevDate = siblings.filter((d) => d < current).sort().pop() ?? null;
  const nextDate = siblings.filter((d) => d > current).sort()[0] ?? null;
  return {
    job,
    property,
    check: {
      today: todaySofia(),
      originalDate: (firstMove?.from_date ?? job.planned_at).slice(0, 10),
      planEndsAt: plan?.status === "cancelled" ? plan.ends_at : null,
      prevDate,
      nextDate,
    },
  };
}

/** GET — позволените дати за клиента (екранът ги показва като min/max). */
export const GET = withAuth({ role: ["admin", "client"] }, async (_request, { session, params }) => {
  const ctx = context(params.id);
  if (!ctx?.property || (!isAdmin(session) && ctx.property.owner_id !== session.uid)) {
    return NextResponse.json({ error: "Обходът не е намерен" }, { status: 404 });
  }
  return NextResponse.json({ window: rescheduleWindow(ctx.check), current: ctx.job.planned_at.slice(0, 10) });
});

export const PATCH = withAuth({ role: ["admin", "client"] }, async (request, { session, params }) => {
  try {
    const ctx = context(params.id);
    const job = ctx?.job;
    const property = ctx?.property;
    if (!ctx || !job || !property || (!isAdmin(session) && property.owner_id !== session.uid)) {
      return NextResponse.json({ error: "Обходът не е намерен" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const to = typeof body.date === "string" ? body.date.slice(0, 10) : "";
    const verdict = canReschedule({
      ...ctx.check,
      status: job.status ?? "planned",
      to,
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
    } else {
      // Екипът знае винаги — и когато обходът няма изпълнител.
      notifyAdmins("job_rescheduled", "Клиент премести обход", `${property.name}: ${label(from)} → ${label(to)}`, "/dashboard");
    }

    return NextResponse.json(db.select().from(jobs).where(eq(jobs.id, job.id)).get());
  } catch (error) {
    console.error("PATCH /api/jobs/[id]/reschedule error:", error);
    return NextResponse.json({ error: "Грешка при преместване" }, { status: 500 });
  }
});
