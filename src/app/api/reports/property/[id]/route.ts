import { db } from "@/db";
import { jobs, properties, users, jobItems, evidence, findings, findingPhotos } from "@/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { generatePropertyReport } from "@/lib/pdf";
import { withAuth, canViewProperty } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = withAuth({}, async (_request, { session, params }) => {
  try {
    const propertyId = params.id;

    // Fetch property
    const property = db
      .select()
      .from(properties)
      .where(eq(properties.id, propertyId))
      .get();

    if (!property) {
      return NextResponse.json({ error: "Имотът не е намерен" }, { status: 404 });
    }

    if (!canViewProperty(session, property)) {
      return NextResponse.json({ error: "Имотът не е намерен" }, { status: 404 });
    }

    // Fetch all jobs for this property
    const propertyJobs = db
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
        assignee_name: users.full_name,
      })
      .from(jobs)
      .leftJoin(users, eq(jobs.assignee_id, users.id))
      .where(eq(jobs.property_id, propertyId))
      .orderBy(desc(jobs.planned_at))
      .all();

    // Fetch all findings for this property
    const propertyFindings = db
      .select({
        id: findings.id,
        title: findings.title,
        body: findings.body,
        status: findings.status,
        created_at: findings.created_at,
        property_id: findings.property_id,
        reporter_name: users.full_name,
      })
      .from(findings)
      .leftJoin(users, eq(findings.reported_by, users.id))
      .where(eq(findings.property_id, propertyId))
      .orderBy(desc(findings.created_at))
      .all();

    // Get item counts and photos for each job
    const jobIds = propertyJobs.map((j) => j.id);
    const enrichedJobs = await Promise.all(
      propertyJobs.map(async (job) => {
        // Item counts
        const items = db
          .select()
          .from(jobItems)
          .where(eq(jobItems.job_id, job.id))
          .all();
        const checked = items.filter((it) => it.done).length;
        const total = items.length;

        // Photo count
        const photos = db
          .select()
          .from(evidence)
          .where(eq(evidence.job_id, job.id))
          .all();

        return {
          ...job,
          itemsChecked: checked,
          itemsTotal: total,
          photoCount: photos.length,
        };
      })
    );

    // Get photos for findings
    const findingIds = propertyFindings.map((f) => f.id);
    const allPhotos =
      findingIds.length > 0
        ? db
            .select()
            .from(findingPhotos)
            .where(inArray(findingPhotos.finding_id, findingIds))
            .all()
        : [];

    const photosByFinding: Record<string, typeof allPhotos> = {};
    for (const p of allPhotos) {
      if (!photosByFinding[p.finding_id]) photosByFinding[p.finding_id] = [];
      photosByFinding[p.finding_id].push(p);
    }

    const enrichedFindings = propertyFindings.map((f) => ({
      ...f,
      photos: (photosByFinding[f.id] || []).map((p) => ({
        url: `/api/photos/${p.storage_path.split("/").pop() || p.storage_path}`,
        taken_at: p.taken_at,
      })),
    }));

    const pdfBuffer = await generatePropertyReport(
      { name: property.name, address: property.address, kind: property.kind },
      enrichedJobs,
      enrichedFindings
    );

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="property-${propertyId.slice(0, 8)}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error("GET /api/reports/property/[id] error:", error);
    return NextResponse.json(
      { error: "Грешка при генериране на PDF отчета за имота" },
      { status: 500 }
    );
  }
});
