import { db } from "@/db";
import { jobs, properties, users, serviceTemplates } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = db
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
      .orderBy(desc(jobs.created_at))
      .all();

    return NextResponse.json(rows);
  } catch (error) {
    console.error("GET /api/jobs error:", error);
    return NextResponse.json({ error: "Грешка при зареждане на задачи" }, { status: 500 });
  }
}

export async function POST(request: Request) {
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
        org_id: "org1",
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

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    console.error("POST /api/jobs error:", error);
    return NextResponse.json({ error: "Грешка при създаване на задача" }, { status: 500 });
  }
}
