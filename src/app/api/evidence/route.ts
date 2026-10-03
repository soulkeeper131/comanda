import { db } from "@/db";
import { evidence, jobItems, jobs, properties } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAuth, canViewProperty, canCompleteJobItem } from "@/lib/auth";
import { claimUpload, uploadFilename } from "@/lib/uploads";
import { isClientId } from "@/lib/domain/idempotency";

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
      .select({ property_id: jobs.property_id, assignee_id: jobs.assignee_id })
      .from(jobs)
      .where(eq(jobs.id, effectiveJobId))
      .get();

    // Инспекторът — само доказателствата от своя обход.
    if (!job || (session.role === "inspector" && job.assignee_id !== session.uid)) {
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

    if (!property || (session.role !== "inspector" && !canViewProperty(session, property))) {
      // 404, не 403 — не издаваме, че задачата съществува
      return NextResponse.json(
        { error: "Задачата не е намерена" },
        { status: 404 }
      );
    }

    const conditions = [];
    if (jobId) {
      conditions.push(eq(evidence.job_id, jobId));
    }
    if (jobItemId) {
      conditions.push(eq(evidence.job_item_id, jobItemId));
    }

    const rows = db
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
      .leftJoin(jobItems, eq(evidence.job_item_id, jobItems.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .all();
    return NextResponse.json(rows);
  } catch (error) {
    console.error("GET /api/evidence error:", error);
    return NextResponse.json(
      { error: "Грешка при зареждане на доказателства" },
      { status: 500 }
    );
  }
});

/**
 * POST /api/evidence — закача качена снимка към обход/стъпка.
 *
 * Това е доказателството, на което стъпват отмятането и завършването —
 * затова: само изпълнителят (или админ), само докато обходът тече, стъпката
 * трябва да е от същия обход и файлът трябва реално да е качен.
 *
 * `client_taken_at` е времето от устройството (офлайн опашката), `taken_at`
 * остава времето на получаване от сървъра — устройството не е доверено.
 */
export const POST = withAuth({ role: ["admin", "inspector"] }, async (request, { session }) => {
  try {
    const body = await request.json();
    const { job_id, job_item_id, storage_path, lat, lng, client_taken_at } = body;
    // Офлайн опашката праща собствен id — повтор след изгубен отговор връща
    // вече записаното, вместо да създаде второ доказателство.
    const clientId = isClientId(body.client_id) ? body.client_id : undefined;
    if (clientId) {
      const existing = db.select().from(evidence).where(eq(evidence.id, clientId)).get();
      if (existing) return NextResponse.json(existing, { status: 200 });
    }

    if (!job_id || typeof storage_path !== "string" || !storage_path) {
      return NextResponse.json(
        { error: "Задача и път до файл са задължителни" },
        { status: 400 }
      );
    }

    const job = db.select().from(jobs).where(eq(jobs.id, job_id)).get();
    if (!job || !canCompleteJobItem(session, job)) {
      return NextResponse.json({ error: "Задачата не е намерена" }, { status: 404 });
    }
    if (job.status !== "in_progress") {
      return NextResponse.json(
        { error: "Снимки се добавят само докато обходът тече" },
        { status: 400 },
      );
    }

    if (job_item_id) {
      const item = db.select().from(jobItems).where(eq(jobItems.id, job_item_id)).get();
      if (!item || item.job_id !== job.id) {
        return NextResponse.json({ error: "Стъпката не е от този обход" }, { status: 400 });
      }
    }

    if (!claimUpload(storage_path, session.uid)) {
      return NextResponse.json({ error: "Снимката не е качена или вече е използвана" }, { status: 400 });
    }

    const [record] = db
      .insert(evidence)
      .values({
        ...(clientId ? { id: clientId } : {}),
        job_id,
        job_item_id: job_item_id || null,
        storage_path: uploadFilename(storage_path),
        lat: typeof lat === "number" ? lat : null,
        lng: typeof lng === "number" ? lng : null,
        client_taken_at: typeof client_taken_at === "string" ? client_taken_at : null,
        uploaded_by: session.uid,
      })
      .returning()
      .all();

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error("POST /api/evidence error:", error);
    return NextResponse.json({ error: "Грешка при записване на доказателство" }, { status: 500 });
  }
});
