import { db } from "@/db";
import { findings, findingPhotos, properties, users, jobItems } from "@/db/schema";
import { eq, desc, inArray, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sendEmail, getNotifyEmail } from "@/lib/email";
import { notifyOwner } from "@/lib/notifications";
import { withAuth, canViewProperty } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/findings?status=open&property_id=X
export const GET = withAuth({}, async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");
    const propertyIdFilter = searchParams.get("property_id");

    const conditions: any[] = [];
    if (statusFilter) {
      conditions.push(eq(findings.status, statusFilter));
    }
    if (propertyIdFilter) {
      conditions.push(eq(findings.property_id, propertyIdFilter));
    }

    let query = db
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
      .leftJoin(users, eq(findings.reported_by, users.id));

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    let rows = query.orderBy(desc(findings.created_at)).all();

    // Клиентът вижда само констатациите по своите имоти
    if (session.role === "client") {
      rows = rows.filter((row) => {
        if (!row.property_id) return false;
        const property = db
          .select()
          .from(properties)
          .where(eq(properties.id, row.property_id))
          .get();
        return property ? canViewProperty(session, property) : false;
      });
    }

    if (rows.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch photos for all findings in one query
    const findingIds = rows.map((r) => r.id);
    const allPhotos = db
      .select()
      .from(findingPhotos)
      .where(inArray(findingPhotos.finding_id, findingIds as string[]))
      .all();

    // Fetch job_item info for those linked
    const jobItemIds = rows
      .map((r) => r.job_item_id)
      .filter(Boolean) as string[];
    const allJobItems =
      jobItemIds.length > 0
        ? db
            .select({
              id: jobItems.id,
              label: jobItems.label,
              zone_label: jobItems.zone_label,
            })
            .from(jobItems)
            .where(inArray(jobItems.id, jobItemIds))
            .all()
        : [];

    const photosByFinding: Record<string, typeof allPhotos> = {};
    for (const p of allPhotos) {
      if (!photosByFinding[p.finding_id]) photosByFinding[p.finding_id] = [];
      photosByFinding[p.finding_id].push(p);
    }

    const jobItemMap: Record<string, (typeof allJobItems)[0]> = {};
    for (const ji of allJobItems) {
      jobItemMap[ji.id] = ji;
    }

    const result = rows.map((row) => ({
      ...row,
      photos: (photosByFinding[row.id] || []).map((p) => ({
        id: p.id,
        storage_path: p.storage_path,
        url: `/api/photos/${p.storage_path.split("/").pop() || p.storage_path}`,
        taken_at: p.taken_at,
      })),
      job_item: row.job_item_id ? jobItemMap[row.job_item_id] || null : null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/findings error:", error);
    return NextResponse.json(
      { error: "Грешка при зареждане на констатации" },
      { status: 500 }
    );
  }
});

export const POST = withAuth({ role: ["admin", "inspector"] }, async (request, { session }) => {
  try {
    const body = await request.json();
    const { property_id, job_id, job_item_id, title, body: desc, photo_ids, reported_by } = body;

    if (!property_id || !title) {
      return NextResponse.json(
        { error: "Имот и заглавие са задължителни" },
        { status: 400 }
      );
    }

    // Insert finding
    const findingId = crypto.randomUUID();
    db.insert(findings)
      .values({
        id: findingId,
        org_id: session.org_id,
        property_id,
        job_id: job_id || null,
        job_item_id: job_item_id || null,
        reported_by: reported_by || null,
        title,
        body: desc || "",
        status: "open",
      })
      .run();

    // Link photos if provided
    if (photo_ids && Array.isArray(photo_ids) && photo_ids.length > 0) {
      for (const photoId of photo_ids) {
        db.insert(findingPhotos)
          .values({
            finding_id: findingId,
            storage_path: photoId.startsWith("data/photos/")
              ? photoId
              : `data/photos/${photoId}`,
          })
          .run();
      }
    }

    // Fetch the created finding with joins
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
      .where(eq(findings.id, findingId))
      .get();

    // Fetch linked photos
    const photos = db
      .select()
      .from(findingPhotos)
      .where(eq(findingPhotos.finding_id, findingId))
      .all();

    // Send email notification
    const propertyName = result?.property_name || "Имот";
    sendEmail({
      to: (await getNotifyEmail()) || "",
      subject: `⚠️ Нова констатация в ${propertyName}: ${title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #dc2626;">⚠️ Нова констатация</h2>
          <p style="color: #247ba0;"><strong>Имот:</strong> ${propertyName}</p>
          <p style="color: #247ba0;"><strong>Заглавие:</strong> ${title}</p>
          ${desc ? `<p style="color: #247ba0;"><strong>Описание:</strong> ${desc}</p>` : ""}
          <hr style="border: none; border-top: 1px solid #e4e9f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">Ко Манда — comanda.blv.bg</p>
        </div>
      `,
    }).catch(() => {}); // fire-and-forget

    return NextResponse.json(
      {
        ...result,
        photos: photos.map((p) => ({
          id: p.id,
          storage_path: p.storage_path,
          url: `/api/photos/${p.storage_path.split("/").pop() || p.storage_path}`,
          taken_at: p.taken_at,
        })),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/findings error:", error);
    return NextResponse.json(
      { error: "Грешка при създаване на констатация" },
      { status: 500 }
    );
  }
});
