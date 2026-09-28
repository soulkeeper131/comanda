import { db } from "@/db";
import { plans, properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAuth, isAdmin } from "@/lib/auth";
import { generateForPlan, removePlannedJobsAfter, todaySofia } from "@/lib/jobs-generator";
import { createNotification, notifyAdmins } from "@/lib/notifications";
import { endOfPaidPeriod } from "@/lib/domain/plans";

export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * PATCH /api/plans/[id]
 *
 * { first_job_at: "YYYY-MM-DD" } — админът насрочва първия обход (въпрос 7);
 *   планът става active и обходите за три месеца се създават веднага.
 * { action: "cancel", ends_at? } — отказ от собственика или админ (въпрос 5):
 *   работи до края на платения период, задачите след него се махат.
 */
export const PATCH = withAuth({ role: ["admin", "client"] }, async (request, { session, params }) => {
  try {
    const plan = db.select().from(plans).where(eq(plans.id, params.id)).get();
    const property = plan && db.select().from(properties).where(eq(properties.id, plan.property_id)).get();
    if (!plan || !property || (!isAdmin(session) && property.owner_id !== session.uid)) {
      return NextResponse.json({ error: "Абонаментът не е намерен" }, { status: 404 });
    }
    const body = await request.json().catch(() => ({}));
    const today = todaySofia();

    if (body.first_job_at !== undefined) {
      if (!isAdmin(session)) {
        return NextResponse.json({ error: "Първият обход се насрочва от администратор" }, { status: 403 });
      }
      const first = String(body.first_job_at).slice(0, 10);
      if (!DATE.test(first) || first < today) {
        return NextResponse.json({ error: "Изберете дата от днес нататък" }, { status: 400 });
      }
      if (plan.status === "cancelled") {
        return NextResponse.json({ error: "Абонаментът е отказан" }, { status: 409 });
      }
      if (plan.first_job_at) {
        return NextResponse.json(
          { error: "Първият обход вече е насрочен — преместете отделните обходи от графика" },
          { status: 409 },
        );
      }
      if (property.status !== "active") {
        return NextResponse.json({ error: "Имотът още не е одобрен" }, { status: 409 });
      }

      db.update(plans).set({ first_job_at: first, status: "active" }).where(eq(plans.id, plan.id)).run();
      const created = generateForPlan(plan.id, today);

      createNotification(
        property.owner_id,
        "plan_scheduled",
        "Първият обход е насрочен",
        `${property.name} — ${new Date(first + "T12:00:00").toLocaleDateString("bg-BG")}`,
        "/dashboard",
      );
      const updated = db.select().from(plans).where(eq(plans.id, plan.id)).get();
      return NextResponse.json({
        ...updated,
        jobs_created: created,
        warning: property.assigned_inspector_id ? undefined : "Имотът няма назначен инспектор — обходите са без изпълнител.",
      });
    }

    if (body.action === "cancel") {
      if (plan.status === "cancelled") {
        return NextResponse.json({ error: "Абонаментът вече е отказан" }, { status: 409 });
      }
      let endsAt = endOfPaidPeriod(today);
      if (isAdmin(session) && typeof body.ends_at === "string" && DATE.test(body.ends_at)) {
        endsAt = body.ends_at < today ? today : body.ends_at;
      }
      // Заявен, но още ненасрочен абонамент спира веднага.
      if (plan.status === "requested") endsAt = today;

      db.update(plans)
        .set({ status: "cancelled", cancelled_at: new Date().toISOString(), ends_at: endsAt })
        .where(eq(plans.id, plan.id))
        .run();
      const removed = removePlannedJobsAfter(plan.id, endsAt);

      if (isAdmin(session)) {
        createNotification(property.owner_id, "plan_scheduled", "Абонаментът е прекратен", `${property.name} — важи до ${endsAt}`, "/dashboard");
      } else {
        notifyAdmins("plan_requested", "Клиент отказа абонамент", `${property.name} — важи до ${endsAt}`, "/dashboard");
      }
      const updated = db.select().from(plans).where(eq(plans.id, plan.id)).get();
      return NextResponse.json({ ...updated, jobs_removed: removed });
    }

    return NextResponse.json({ error: "Няма действие" }, { status: 400 });
  } catch (error) {
    console.error("PATCH /api/plans/[id] error:", error);
    return NextResponse.json({ error: "Грешка при промяна на абонамента" }, { status: 500 });
  }
});
