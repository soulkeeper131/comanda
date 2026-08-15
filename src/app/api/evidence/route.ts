import { db } from "@/db";
import { evidence, jobItems, jobs, properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAuth, canViewProperty } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = withAuth({}, async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("job_id");
    const jobItemId = searchParams.get("job_item_id");

    if (!jobId && !jobItemId) {
      return NextResponse.json(
        { error: "job_id или job_item_id е задължително" },
        { status: 400 }
      );
    }

    // Веригата evidence.job_id → jobs.property_id → properties → canViewProperty,
    // както в jobs/[id]/route.ts. Ако е подаден само job_item_id, намираме
    // job_id през jobItems.
    let effectiveJobId = jobId;
    if (!effectiveJobId && jobItemId) {
      const item = db
        .select({ job_id: jobItems.job_id })
        .from(jobItems)
        .where(eq(jobItems.id, jobItemId))
        .get();
      effectiveJobId = item?.job_id ?? null;
    }

    if (!effectiveJobId) {
      // 404, не 400 — не издаваме дали job_item_id съществува
      return NextResponse.json(
        { error: "Задачата не е намерена" },
        { status: 404 }
      );
    }

    const job = db
      .select({ property_id: jobs.property_id })
      .from(jobs)
      .where(eq(jobs.id, effectiveJobId))
      .get();

    if (!job) {
      return NextResponse.json(
        { error: "Задачата не е намерена" },
        { status: 404 }
      );
    }

    const property = db
      .select()
      .from(properties)
      .where(eq(properties.id, job.property_id))
      .get();

    if (!property || !canViewProperty(session, property)) {
      // 404, не 403 — не издаваме, че задачата съществува
      return NextResponse.json(
        { error: "Задачата не е намерена" },
        { status: 404 }
      );
    }

    let query = db
      .select({
        id: evidence.id,
        job_id: evidence.job_id,
        job_item_id: evidence.job_item_id,
        storage_path: evidence.storage_path,
        taken_at: evidence.taken_at,
        lat: evidence.lat,
        lng: evidence.lng,
        item_label: jobItems.label,
        item_zone_label: jobItems.zone_label,
      })
      .from(evidence)
      .leftJoin(jobItems, eq(evidence.job_item_id, jobItems.id));

    if (jobId) {
      query = query.where(eq(evidence.job_id, jobId));
    }
    if (jobItemId) {
      query = query.where(eq(evidence.job_item_id, jobItemId));
    }

    const rows = query.all();
    return NextResponse.json(rows);
  } catch (error) {
    console.error("GET /api/evidence error:", error);
    return NextResponse.json(
      { error: "Грешка при зареждане на доказателства" },
      { status: 500 }
    );
  }
});

export const POST = withAuth({ role: ["admin", "inspector"] }, async (request) => {
  try {
    const body = await request.json();
    const { job_id, job_item_id, storage_path, lat, lng } = body;

    if (!job_id || !storage_path) {
      return NextResponse.json(
        { error: "Задача и път до файл са задължителни" },
        { status: 400 }
      );
    }

    const [record] = db
      .insert(evidence)
      .values({
        job_id,
        job_item_id: job_item_id || null,
        storage_path,
        lat: lat ?? null,
        lng: lng ?? null,
      })
      .returning();

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error("POST /api/evidence error:", error);
    return NextResponse.json({ error: "Грешка при записване на доказателство" }, { status: 500 });
  }
});
