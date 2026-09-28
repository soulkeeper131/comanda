import { db } from "@/db";
import { plans, properties, packages, jobs } from "@/db/schema";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { todaySofia } from "@/lib/jobs-generator";

export const dynamic = "force-dynamic";

/** GET /api/me/plans — абонаментите на клиента + следващият обход по всеки. */
export const GET = withAuth({}, async (_request, { session }) => {
  try {
    const rows = db
      .select({ plan: plans, property_name: properties.name, package_name: packages.name })
      .from(plans)
      .innerJoin(properties, eq(plans.property_id, properties.id))
      .leftJoin(packages, eq(plans.package_id, packages.id))
      .where(eq(properties.owner_id, session.uid))
      .all();

    const ids = rows.map((r) => r.plan.id);
    const upcoming = ids.length
      ? db
          .select({ plan_id: jobs.plan_id, planned_at: jobs.planned_at })
          .from(jobs)
          .where(and(inArray(jobs.plan_id, ids), eq(jobs.status, "planned"), gte(jobs.planned_at, todaySofia())))
          .orderBy(asc(jobs.planned_at))
          .all()
      : [];

    return NextResponse.json(
      rows.map((r) => ({
        ...r.plan,
        property_name: r.property_name,
        package_name: r.package_name,
        next_job_at: upcoming.find((j) => j.plan_id === r.plan.id)?.planned_at ?? null,
      })),
    );
  } catch (error) {
    console.error("GET /api/me/plans error:", error);
    return NextResponse.json({ error: "Грешка" }, { status: 500 });
  }
});
