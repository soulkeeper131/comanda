import { db } from "@/db";
import { jobs, properties, users, serviceTemplates, jobItems, evidence } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
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

    let query = db
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
      .leftJoin(users, eq(jobs.assignee_id, users.id));

    if (assigneeIdFilter) {
      query = query.where(eq(jobs.assignee_id, assigneeIdFilter));
    }
    if (statusFilter) {
      query = query.where(
        eq(jobs.status, statusFilter as "planned" | "in_progress" | "completed" | "cancelled"),
      );
    }

    let rows = query.orderBy(desc(jobs.created_at)).all();

    // Клиентът вижда само задачите за своите имоти
    if (session.role === "client") {
      rows = rows.filter((row) => {
        if (!row.property_id) return false;
        const property = db
          .select()
          .from(properties)
          .where(eq(properties.id, row.property_id))
          .get();
        return property ? canViewProperty(session, property) : false;
      });
    }

    // Compute itemsChecked / itemsTotal per job
    // Fetch all items for jobs in this result set
    const jobIds = rows.map((j) => j.id);
    if (jobIds.length > 0) {
      // Build a map of job_id -> { checked, total }
      const itemCounts: Record<string, { checked: number; total: number }> = {};

      // SQLite doesn't support array IN with drizzle easily, so we query all items
      // and filter in JS. For small datasets this is fine.
      const allItems = db
        .select({
          job_id: jobItems.job_id,
          done: jobItems.done,
        })
        .from(jobItems)
        .all();

      for (const item of allItems) {
        if (!itemCounts[item.job_id]) {
          itemCounts[item.job_id] = { checked: 0, total: 0 };
        }
        itemCounts[item.job_id].total++;
        if (item.done) {
          itemCounts[item.job_id].checked++;
        }
      }

      // Also count evidence photos per job
      const allPhotos = db
        .select({
          job_id: evidence.job_id,
        })
        .from(evidence)
        .all();

      const photoCounts: Record<string, number> = {};
      for (const p of allPhotos) {
        photoCounts[p.job_id] = (photoCounts[p.job_id] || 0) + 1;
      }

      for (const row of rows) {
        const counts = itemCounts[row.id] || { checked: 0, total: 0 };
        (row as any).itemsChecked = counts.checked;
        (row as any).itemsTotal = counts.total;
        (row as any).photoCount = photoCounts[row.id] || 0;
        (row as any).started_at = row.check_in;
        (row as any).completed_at = row.check_out;
      }
    }

    return NextResponse.json(rows);
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
