import { db } from "@/db";
import { jobs, findings, offers, properties } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const activeJobs = db
      .select({ count: sql<number>`count(*)` })
      .from(jobs)
      .where(eq(jobs.status, "in_progress"))
      .get()?.count ?? 0;

    const plannedJobs = db
      .select({ count: sql<number>`count(*)` })
      .from(jobs)
      .where(eq(jobs.status, "planned"))
      .get()?.count ?? 0;

    const completedJobs = db
      .select({ count: sql<number>`count(*)` })
      .from(jobs)
      .where(eq(jobs.status, "completed"))
      .get()?.count ?? 0;

    const openFindings = db
      .select({ count: sql<number>`count(*)` })
      .from(findings)
      .where(eq(findings.status, "open"))
      .get()?.count ?? 0;

    const pendingOffers = db
      .select({ count: sql<number>`count(*)` })
      .from(offers)
      .where(eq(offers.decision, "pending"))
      .get()?.count ?? 0;

    const totalProperties = db
      .select({ count: sql<number>`count(*)` })
      .from(properties)
      .where(eq(properties.archived, false))
      .get()?.count ?? 0;

    return NextResponse.json({
      activeJobs,
      plannedJobs,
      completedJobs,
      openFindings,
      pendingOffers,
      totalProperties,
    });
  } catch (error) {
    console.error("GET /api/stats error:", error);
    return NextResponse.json({ error: "Грешка при зареждане на статистика" }, { status: 500 });
  }
}
