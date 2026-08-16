import { db } from "@/db";
import { jobs, templateItems, jobItems, properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { notifyOwner } from "@/lib/notifications";
import { withAuth, canOverride } from "@/lib/auth";
import { distanceMeters } from "@/lib/geo";
import { recordOverride } from "@/lib/domain/overrides";

export const dynamic = "force-dynamic";

export const POST = withAuth({ role: ["admin", "inspector"] }, async (request, { session, params }) => {
  try {
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const { lat, lng, override_reason } = body ?? {};

    // Get the job
    const job = db.select().from(jobs).where(eq(jobs.id, id)).get();
    if (!job) {
      return NextResponse.json({ error: "Задачата не е намерена" }, { status: 404 });
    }

    if (!job.template_id) {
      return NextResponse.json(
        { error: "Задачата няма свързан шаблон" },
        { status: 400 }
      );
    }

    if (job.status !== "planned") {
      return NextResponse.json(
        { error: "Задачата може да бъде стартирана само от статус 'planned'" },
        { status: 400 }
      );
    }

    // Check if job already has items (prevent double-start)
    const existingItems = db
      .select()
      .from(jobItems)
      .where(eq(jobItems.job_id, id))
      .all();

    if (existingItems.length > 0) {
      return NextResponse.json(
        { error: "Задачата вече е стартирана и има налични стъпки" },
        { status: 400 }
      );
    }

    // Геофенсинг: инспекторът трябва да е в периметъра на имота при check-in.
    const property = db.select().from(properties).where(eq(properties.id, job.property_id)).get();
    if (!property) {
      return NextResponse.json({ error: "Имотът не е намерен" }, { status: 404 });
    }

    const radius = property.geofence_m ?? 75;
    const hasCoords =
      typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng);
    const distance = hasCoords
      ? distanceMeters({ lat, lng }, { lat: property.lat, lng: property.lng })
      : null;
    // geofence_m <= 0 изключва проверката — изрично конфигуриран имот без периметър.
    const geofenceActive = radius > 0;
    const insideFence = !geofenceActive || (distance !== null && distance <= radius);

    if (!insideFence) {
      // Извън периметъра (или без координати) — само админ минава, и то с причина
      if (!canOverride(session)) {
        return NextResponse.json(
          {
            error: hasCoords
              ? `Намирате се на ${Math.round(distance!)} м от имота. Трябва да сте в рамките на ${radius} м.`
              : "Локацията е недостъпна. Разрешете достъп до местоположението.",
            distance_m: distance !== null ? Math.round(distance) : null,
            geofence_m: radius,
          },
          { status: 403 },
        );
      }

      if (!override_reason || typeof override_reason !== "string" || override_reason.trim().length < 5) {
        return NextResponse.json(
          { error: "За стартиране извън периметъра е задължителна причина (поне 5 знака)." },
          { status: 400 },
        );
      }

      recordOverride({
        admin_id: session.uid,
        entity_type: "job_checkin",
        entity_id: job.id,
        reason: override_reason.trim(),
      });
    }

    // Get template items
    const items = db
      .select()
      .from(templateItems)
      .where(eq(templateItems.template_id, job.template_id))
      .all();

    if (items.length === 0) {
      return NextResponse.json(
        { error: "Шаблонът няма дефинирани стъпки" },
        { status: 400 }
      );
    }

    // Copy template items to job items
    const now = new Date().toISOString();
    for (const item of items) {
      db.insert(jobItems).values({
        job_id: id,
        zone_label: item.zone_label,
        label: item.label,
        proof_type: item.proof_type,
        required: item.required ?? true,
        sort: item.sort,
        done: false,
      }).run();
    }

    // Update job status to in_progress and set check_in
    db.update(jobs)
      .set({
        status: "in_progress",
        check_in: now,
        check_in_lat: hasCoords ? lat : null,
        check_in_lng: hasCoords ? lng : null,
      })
      .where(eq(jobs.id, id))
      .run();

    // Return updated job with items
    const updatedJob = db.select().from(jobs).where(eq(jobs.id, id)).get();
    const updatedItems = db.select().from(jobItems).where(eq(jobItems.job_id, id)).all();

    // Notify property owner about started job
    const prop = db.select({ name: properties.name }).from(properties).where(eq(properties.id, job.property_id)).get();
    notifyOwner(
      job.property_id,
      "job_started",
      "🔧 Започнат обход",
      `${job.title || "Обход"} — ${prop?.name || "Имот"}`,
      "/dashboard",
    );

    return NextResponse.json({ ...updatedJob, items: updatedItems });
  } catch (error) {
    console.error("POST /api/jobs/[id]/start error:", error);
    return NextResponse.json({ error: "Грешка при стартиране на задача" }, { status: 500 });
  }
});
