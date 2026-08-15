import { db } from "@/db";
import { jobs, jobItems, properties, users, evidence } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAuth, canViewProperty } from "@/lib/auth";

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
