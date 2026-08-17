import { db } from "@/db";
import { jobs, properties, users, jobItems, evidence, findings, findingPhotos } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { generateJobReport } from "@/lib/pdf";
import { withAuth, canViewProperty } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = withAuth({}, async (_request, { session, params }) => {
  try {
    const jobId = params.id;

    // Fetch job with joins
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
        property_name: properties.name,
        property_addr: properties.address,
        property_owner_id: properties.owner_id,
        assignee_name: users.full_name,
      })
      .from(jobs)
      .leftJoin(properties, eq(jobs.property_id, properties.id))
      .leftJoin(users, eq(jobs.assignee_id, users.id))
      .where(eq(jobs.id, jobId))
      .get();

    if (!job) {
      return NextResponse.json({ error: "Обходът не е намерен" }, { status: 404 });
    }

    if (
      !job.property_owner_id ||
      !canViewProperty(session, { owner_id: job.property_owner_id })
    ) {
      return NextResponse.json({ error: "Обходът не е намерен" }, { status: 404 });
    }

    // Fetch job items
    const items = db
      .select()
      .from(jobItems)
      .where(eq(jobItems.job_id, jobId))
      .orderBy(jobItems.sort)
      .all();

    // Fetch evidence photos
    const photos = db
      .select()
      .from(evidence)
      .where(eq(evidence.job_id, jobId))
      .all()
      .map((p) => {
        const filename = p.storage_path.split("/").pop() || p.storage_path;
        return {
          url: `/api/photos/${filename}`,
          taken_at: p.taken_at,
        };
      });

    const pdfBuffer = await generateJobReport({
      ...job,
      items,
      photos,
    });

    // Buffer не се приема директно като BodyInit — обвиваме в Uint8Array (виж photos/[id]/route.ts).
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="job-${jobId.slice(0, 8)}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error("GET /api/reports/job/[id] error:", error);
    return NextResponse.json(
      { error: "Грешка при генериране на PDF отчета" },
      { status: 500 }
    );
  }
});
