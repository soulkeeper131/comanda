import { db } from "@/db";
import { jobs, jobItems, properties, users, evidence, jobReschedules } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAuth, canViewProperty } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export const GET = withAuth({}, async (_request, { session, params }) => {
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
        property_address: properties.address,
        property_lat: properties.lat,
        property_lng: properties.lng,
        access_notes: properties.access_notes,
        contact_name: properties.contact_name,
        contact_phone: properties.contact_phone,
        rescheduled_from: jobs.rescheduled_from,
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

    const property = db.select().from(properties).where(eq(properties.id, job.property_id)).get();
    if (!property || !canViewProperty(session, property)) {
      // 404, не 403 — не издаваме, че задачата съществува
      return NextResponse.json({ error: "Задачата не е намерена" }, { status: 404 });
    }

    const items = db
      .select({
        id: jobItems.id,
        job_id: jobItems.job_id,
        zone_label: jobItems.zone_label,
        label: jobItems.label,
        proof_type: jobItems.proof_type,
        required: jobItems.required,
        sort: jobItems.sort,
        done: jobItems.done,
        count_value: jobItems.count_value,
        note: jobItems.note,
      })
      .from(jobItems)
      .where(eq(jobItems.job_id, id))
      .orderBy(jobItems.sort)
      .all();

    // Fetch evidence photos for this job, grouped by job_item_id
    const photos = db
      .select({
        id: evidence.id,
        job_item_id: evidence.job_item_id,
        storage_path: evidence.storage_path,
        taken_at: evidence.taken_at,
        client_taken_at: evidence.client_taken_at,
        lat: evidence.lat,
        lng: evidence.lng,
      })
      .from(evidence)
      .where(eq(evidence.job_id, id))
      .all();

    // Attach photos to their items
    const photosByItem: Record<string, typeof photos> = {};
    for (const p of photos) {
      const key = p.job_item_id || "__unlinked__";
      if (!photosByItem[key]) photosByItem[key] = [];
      photosByItem[key].push(p);
    }

    // Also collect unlinked photos (no job_item_id)
    const unlinkedPhotos = photosByItem["__unlinked__"] || [];
    delete photosByItem["__unlinked__"];

    const itemsWithPhotos = items.map((item) => ({
      id: item.id,
      label: item.label,
      zone_label: item.zone_label,
      done: item.done,
      required: item.required,
      sort: item.sort,
      evidence_type: item.proof_type,
      note: item.note,
      count_value: item.count_value,
      photos: (photosByItem[item.id] || []).map((p) => ({
        id: p.id,
        storage_path: p.storage_path,
        taken_at: p.taken_at,
        client_taken_at: p.client_taken_at,
        lat: p.lat,
        lng: p.lng,
      })),
    }));

    const result = {
      ...job,
      started_at: job.check_in,
      completed_at: job.check_out,
      items: itemsWithPhotos,
      photos: unlinkedPhotos.map((p) => ({
        id: p.id,
        storage_path: p.storage_path,
        taken_at: p.taken_at,
        lat: p.lat,
        lng: p.lng,
      })),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/jobs/[id] error:", error);
    return NextResponse.json({ error: "Грешка при зареждане на задача" }, { status: 500 });
  }
});

/**
 * DELETE /api/jobs/[id] — само грешно създаден, още нестартиран обход.
 * Стартиран или завършен е история — той се отказва (/cancel), не се трие.
 */
export const DELETE = withAuth({ role: ["admin"] }, async (_request, { params }) => {
  try {
    const job = db.select().from(jobs).where(eq(jobs.id, params.id)).get();
    if (!job) return NextResponse.json({ error: "Задачата не е намерена" }, { status: 404 });
    if (job.status !== "planned") {
      return NextResponse.json(
        { error: "Изтрива се само планирана задача. Стартираната се отказва." },
        { status: 400 },
      );
    }
    db.transaction((tx) => {
      tx.delete(jobReschedules).where(eq(jobReschedules.job_id, job.id)).run();
      tx.delete(jobs).where(eq(jobs.id, job.id)).run();
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/jobs/[id] error:", error);
    return NextResponse.json({ error: "Грешка при изтриване" }, { status: 500 });
  }
});

/**
 * PATCH /api/jobs/[id] — админът сменя изпълнителя/заглавието на конкретен
 * обход, без да пипа инспектора на имота (въпрос 10). Датата се мести през
 * /reschedule (там се пази история).
 */
export const PATCH = withAuth({ role: ["admin"] }, async (request, { params }) => {
  try {
    const job = db.select().from(jobs).where(eq(jobs.id, params.id)).get();
    if (!job) return NextResponse.json({ error: "Задачата не е намерена" }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    const updates: Partial<typeof jobs.$inferInsert> = {};

    if (body.assignee_id !== undefined) {
      if (job.status === "completed" || job.status === "cancelled") {
        return NextResponse.json({ error: "Обходът е приключил" }, { status: 400 });
      }
      if (body.assignee_id === null || body.assignee_id === "") {
        updates.assignee_id = null;
      } else {
        const person = db.select().from(users).where(eq(users.id, body.assignee_id)).get();
        if (!person || person.role !== "inspector" || person.active === false) {
          return NextResponse.json({ error: "Изберете активен инспектор" }, { status: 400 });
        }
        updates.assignee_id = person.id;
      }
    }
    if (typeof body.title === "string" && body.title.trim()) updates.title = body.title.trim();
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Няма полета за обновяване" }, { status: 400 });
    }

    db.update(jobs).set(updates).where(eq(jobs.id, job.id)).run();
    if (updates.assignee_id && updates.assignee_id !== job.assignee_id) {
      const prop = db.select({ name: properties.name }).from(properties).where(eq(properties.id, job.property_id)).get();
      createNotification(updates.assignee_id, "job_started", "Възложен ви е обход", `${prop?.name ?? "Имот"} — ${job.planned_at.slice(0, 10)}`, "/dashboard");
    }
    return NextResponse.json(db.select().from(jobs).where(eq(jobs.id, job.id)).get());
  } catch (error) {
    console.error("PATCH /api/jobs/[id] error:", error);
    return NextResponse.json({ error: "Грешка при промяна на обхода" }, { status: 500 });
  }
});
