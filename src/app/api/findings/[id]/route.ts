import { db } from "@/db";
import { findings, findingPhotos, properties, users, jobItems } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["open", "in_progress", "resolved"] as const;

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { status, title, body: desc, property_id, job_id, job_item_id } = body;

    // Check finding exists
    const existing = db
      .select()
      .from(findings)
      .where(eq(findings.id, id))
      .get();

    if (!existing) {
      return NextResponse.json(
        { error: "Констатацията не е намерена" },
        { status: 404 }
      );
    }

    // Build update fields
    const updates: Record<string, unknown> = {};

    if (status) {
      if (!VALID_STATUSES.includes(status as "open" | "in_progress" | "resolved")) {
        return NextResponse.json(
          {
            error: `Невалиден статус. Позволени: ${VALID_STATUSES.join(", ")}`,
          },
          { status: 400 }
        );
      }
      updates.status = status;
    }

    if (title !== undefined) updates.title = title;
    if (desc !== undefined) updates.body = desc;
    if (property_id !== undefined) updates.property_id = property_id;
    if (job_id !== undefined) updates.job_id = job_id;
    if (job_item_id !== undefined) updates.job_item_id = job_item_id;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Няма полета за обновяване" },
        { status: 400 }
      );
    }

    db.update(findings).set(updates).where(eq(findings.id, id)).run();

    // Return updated finding with joins
    const result = db
      .select({
        id: findings.id,
        org_id: findings.org_id,
        property_id: findings.property_id,
        job_id: findings.job_id,
        job_item_id: findings.job_item_id,
        reported_by: findings.reported_by,
        title: findings.title,
        body: findings.body,
        status: findings.status,
        created_at: findings.created_at,
        property_name: properties.name,
        reporter_name: users.full_name,
      })
      .from(findings)
      .leftJoin(properties, eq(findings.property_id, properties.id))
      .leftJoin(users, eq(findings.reported_by, users.id))
      .where(eq(findings.id, id))
      .get();

    const photos = db
      .select()
      .from(findingPhotos)
      .where(eq(findingPhotos.finding_id, id))
      .all();

    // Job item info if linked
    let jobItemInfo = null;
    if (result?.job_item_id) {
      const ji = db
        .select({
          id: jobItems.id,
          label: jobItems.label,
          zone_label: jobItems.zone_label,
        })
        .from(jobItems)
        .where(eq(jobItems.id, result.job_item_id))
        .get();
      jobItemInfo = ji || null;
    }

    return NextResponse.json({
      ...result,
      photos: photos.map((p) => ({
        id: p.id,
        storage_path: p.storage_path,
        url: `/api/photos/${p.storage_path.split("/").pop() || p.storage_path}`,
        taken_at: p.taken_at,
      })),
      job_item: jobItemInfo,
    });
  } catch (error) {
    console.error("PATCH /api/findings/[id] error:", error);
    return NextResponse.json(
      { error: "Грешка при обновяване на констатация" },
      { status: 500 }
    );
  }
}
