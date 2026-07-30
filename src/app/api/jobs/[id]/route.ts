import { db } from "@/db";
import { jobs, jobItems, properties, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const job = db
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
      .where(eq(jobs.id, id))
      .get();

    if (!job) {
      return NextResponse.json({ error: "Задачата не е намерена" }, { status: 404 });
    }

    const items = db
      .select()
      .from(jobItems)
      .where(eq(jobItems.job_id, id))
      .all();

    return NextResponse.json({ ...job, items });
  } catch (error) {
    console.error("GET /api/jobs/[id] error:", error);
    return NextResponse.json({ error: "Грешка при зареждане на задача" }, { status: 500 });
  }
}
