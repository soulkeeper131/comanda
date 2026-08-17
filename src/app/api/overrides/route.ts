import { db } from "@/db";
import { overrides, jobItems, jobs, properties } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAuth, canViewProperty } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/overrides?entity_type=job_item|job_checkin&entity_id=X,Y,Z
 *
 * Само за четене — записването остава изключително в recordOverride()
 * (src/lib/domain/overrides.ts), викана от местата, където реално се
 * прескача проверка. Тук само показваме какво вече е прескочено, скопено
 * по права: клиентът вижда прескачания само за собствените си имоти,
 * админ/инспектор виждат каквото поискат.
 *
 * Честността към клиента (Task 20) изисква "проверката е прескочена от
 * админ — причина: …" да се показва на екрана на имота, затова този route
 * съществува — иначе клиентът няма как да разбере.
 */
export const GET = withAuth({}, async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entity_type");
    const entityIdsParam = searchParams.get("entity_id");

    if (entityType !== "job_item" && entityType !== "job_checkin") {
      return NextResponse.json(
        { error: "entity_type трябва да е job_item или job_checkin" },
        { status: 400 },
      );
    }
    if (!entityIdsParam) {
      return NextResponse.json({ error: "entity_id е задължителен" }, { status: 400 });
    }

    const entityIds = entityIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (entityIds.length === 0) {
      return NextResponse.json([]);
    }

    let rows = db
      .select()
      .from(overrides)
      .where(inArray(overrides.entity_id, entityIds))
      .all()
      .filter((o) => o.entity_type === entityType);

    if (session.role === "client") {
      // Прескачането сочи към job_item или job (чрез entity_id), а те към
      // property — оттам идва обхватът, същия принцип като findings/offers.
      const jobItemIds = entityType === "job_item" ? rows.map((r) => r.entity_id) : [];
      const jobIdByItem = new Map<string, string>();
      if (jobItemIds.length > 0) {
        const items = db
          .select({ id: jobItems.id, job_id: jobItems.job_id })
          .from(jobItems)
          .where(inArray(jobItems.id, jobItemIds))
          .all();
        for (const it of items) jobIdByItem.set(it.id, it.job_id);
      }

      const jobIds =
        entityType === "job_checkin"
          ? rows.map((r) => r.entity_id)
          : Array.from(jobIdByItem.values());

      const relatedJobs =
        jobIds.length > 0
          ? db.select({ id: jobs.id, property_id: jobs.property_id }).from(jobs).where(inArray(jobs.id, jobIds)).all()
          : [];
      const propertyIdByJob = new Map(relatedJobs.map((j) => [j.id, j.property_id]));

      const propertyIds = Array.from(new Set(relatedJobs.map((j) => j.property_id)));
      const relatedProperties =
        propertyIds.length > 0
          ? db.select().from(properties).where(inArray(properties.id, propertyIds)).all()
          : [];
      const propertyById = new Map(relatedProperties.map((p) => [p.id, p]));

      rows = rows.filter((o) => {
        const jobId = entityType === "job_checkin" ? o.entity_id : jobIdByItem.get(o.entity_id);
        const propertyId = jobId ? propertyIdByJob.get(jobId) : undefined;
        const property = propertyId ? propertyById.get(propertyId) : undefined;
        return property ? canViewProperty(session, property) : false;
      });
    }

    return NextResponse.json(rows);
  } catch (error) {
    console.error("GET /api/overrides error:", error);
    return NextResponse.json({ error: "Грешка при зареждане" }, { status: 500 });
  }
});
