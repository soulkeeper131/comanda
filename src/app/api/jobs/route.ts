import { db } from "@/db";
import { jobs, properties, users, serviceTemplates, jobItems, evidence } from "@/db/schema";
import { eq, desc, and, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { createNotification, notifyOwner } from "@/lib/notifications";
import { withAuth, canViewProperty } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Fire-and-forget push notification
async function pushNotify(title: string, propertyId: string) {
  try {
    const prop = db.select().from(properties).where(eq(properties.id, propertyId)).get();
    const propName = prop?.name || "Имот";
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "https://comanda.blv.bg"}/api/push/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "📋 Нова задача",
        body: `${title} — ${propName}`,
        url: "/dashboard",
      }),
    });
  } catch (e) {
    // Silently fail — push is best-effort
  }
}

// GET /api/jobs?assignee_id=X&status=Y
export const GET = withAuth({}, async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const assigneeIdFilter = searchParams.get("assignee_id");
    const statusFilter = searchParams.get("status");

    // Условията се събират предварително — преприсвояването на query builder-а
    // към себе си след .where() не се типизира коректно от Drizzle.
    const conditions = [];
    if (assigneeIdFilter) {
      conditions.push(eq(jobs.assignee_id, assigneeIdFilter));
    }
    if (statusFilter) {
      conditions.push(
        eq(jobs.status, statusFilter as "planned" | "in_progress" | "completed" | "cancelled"),
      );
    }

    let rows = db
      .select({
        id: jobs.id,
        title: jobs.title,
        status: jobs.status,
        planned_at: jobs.planned_at,
        duration_min: jobs.duration_min,
        check_in: jobs.check_in,
        check_out: jobs.check_out,
        note: jobs.note,
        created_at: jobs.created_at,
        property_id: jobs.property_id,
        assignee_id: jobs.assignee_id,
        template_id: jobs.template_id,
        plan_id: jobs.plan_id,
        org_id: jobs.org_id,
        property_name: properties.name,
        assignee_name: users.full_name,
      })
      .from(jobs)
      .leftJoin(properties, eq(jobs.property_id, properties.id))
      .leftJoin(users, eq(jobs.assignee_id, users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(jobs.created_at))
      .all();

    // Клиентът вижда само задачите за своите имоти. Вземаме наведнъж имотите
    // за всички property_id в резултата (една заявка), вместо по един на ред.
    if (session.role === "client") {
      const propertyIds = Array.from(
        new Set(rows.map((r) => r.property_id).filter((id): id is string => !!id)),
      );
      const ownProperties =
        propertyIds.length > 0
          ? db.select().from(properties).where(inArray(properties.id, propertyIds)).all()
          : [];
      const propertiesById = new Map(ownProperties.map((p) => [p.id, p]));

      rows = rows.filter((row) => {
        if (!row.property_id) return false;
        const property = propertiesById.get(row.property_id);
        return property ? canViewProperty(session, property) : false;
      });
    }

    // Compute itemsChecked / itemsTotal / photoCount per job с групови (агрегиращи)
    // заявки вместо да теглим всички редове от job_items/evidence в паметта.
    const jobIds = rows.map((j) => j.id);
    const withComputed = rows.map((row) => ({
      ...row,
      itemsChecked: 0,
      itemsTotal: 0,
      photoCount: 0,
      started_at: row.check_in,
      completed_at: row.check_out,
    }));

    if (jobIds.length > 0) {
      const itemCounts = db
        .select({
          job_id: jobItems.job_id,
          total: sql<number>`count(*)`,
          checked: sql<number>`sum(case when ${jobItems.done} then 1 else 0 end)`,
        })
        .from(jobItems)
        .where(inArray(jobItems.job_id, jobIds))
        .groupBy(jobItems.job_id)
        .all();
      const itemCountsByJob = new Map(itemCounts.map((c) => [c.job_id, c]));

      const photoCounts = db
        .select({
          job_id: evidence.job_id,
          count: sql<number>`count(*)`,
        })
        .from(evidence)
        .where(inArray(evidence.job_id, jobIds))
        .groupBy(evidence.job_id)
        .all();
      const photoCountsByJob = new Map(photoCounts.map((c) => [c.job_id, c.count]));

      for (const row of withComputed) {
        const counts = itemCountsByJob.get(row.id);
        row.itemsChecked = counts ? Number(counts.checked) : 0;
        row.itemsTotal = counts ? Number(counts.total) : 0;
        row.photoCount = photoCountsByJob.get(row.id) ? Number(photoCountsByJob.get(row.id)) : 0;
      }
    }

    return NextResponse.json(withComputed);
  } catch (error) {
    console.error("GET /api/jobs error:", error);
    return NextResponse.json({ error: "Грешка при зареждане на задачи" }, { status: 500 });
  }
});

export const POST = withAuth({ role: ["admin"] }, async (request, { session }) => {
  try {
    const body = await request.json();
    const { property_id, assignee_id, template_id, planned_at, title: bodyTitle } = body;

    if (!property_id || !planned_at) {
      return NextResponse.json(
        { error: "Имот и планирана дата са задължителни" },
        { status: 400 }
      );
    }

    let jobTitle = bodyTitle || null;
    let durationMin: number | null = null;

    // Auto-fill from template if provided
    if (template_id) {
      const template = db
        .select()
        .from(serviceTemplates)
        .where(eq(serviceTemplates.id, template_id))
        .get();

      if (template) {
        durationMin = template.duration_min ?? null;

        if (!jobTitle) {
          const property = db
            .select()
            .from(properties)
            .where(eq(properties.id, property_id))
            .get();
          jobTitle = `${template.name} - ${property?.name || "Имот"}`;
        }
      }
    }

    if (!jobTitle) {
      jobTitle = "Задача";
    }

    db
      .insert(jobs)
      .values({
        org_id: session.org_id,
        property_id,
        assignee_id: assignee_id || null,
        template_id: template_id || null,
        title: jobTitle,
        duration_min: durationMin,
        planned_at,
        status: "planned",
      })
      .run();

    // SQLite no RETURNING — fetch the last inserted job
    const [job] = db.select().from(jobs).orderBy(desc(jobs.created_at)).limit(1).all();

    // Fire push notification (non-blocking)
    pushNotify(jobTitle, property_id).catch((e) =>
      console.error("Push notify error:", e)
    );

    // Notify assignee (worker) about new job
    if (assignee_id) {
      const prop = db.select({ name: properties.name }).from(properties).where(eq(properties.id, property_id)).get();
      createNotification(
        assignee_id,
        "job_started",
        "📋 Възложен нов обход",
        `${jobTitle} — ${prop?.name || "Имот"}`,
        "/dashboard",
      );
    }

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    console.error("POST /api/jobs error:", error);
    return NextResponse.json({ error: "Грешка при създаване на задача" }, { status: 500 });
  }
});
