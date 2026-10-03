import { NextResponse } from "next/server";
import { db } from "@/db";
import { findingPhotos, findings, properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { withAuth, canAccessProperty, propertyScope, canViewProperty } from "@/lib/auth";
import { saveImageUpload } from "@/lib/uploads";

export const dynamic = "force-dynamic";

// POST — снимка към констатация (админ или инспекторът на имота).
export const POST = withAuth({ role: ["admin", "inspector"] }, async (request, { session }) => {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const findingId = formData.get("finding_id")?.toString();
    if (!findingId) {
      return NextResponse.json({ error: "Липсва finding_id" }, { status: 400 });
    }

    const finding = db.select().from(findings).where(eq(findings.id, findingId)).get();
    const property = finding && db.select().from(properties).where(eq(properties.id, finding.property_id)).get();
    // Инспектор — само за имот, до който има достъп (иначе снимката му
    // излиза при чужд клиент).
    if (!finding || !property || !canAccessProperty(session, property)) {
      return NextResponse.json({ error: "Констатацията не е намерена" }, { status: 404 });
    }
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Липсва файл" }, { status: 400 });
    }

    const saved = await saveImageUpload(file, session.uid, { attached: true });
    if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: saved.status });
    const storagePath = `data/photos/${saved.filename}`;

    const photoId = crypto.randomUUID();
    db.insert(findingPhotos).values({ id: photoId, finding_id: findingId, storage_path: storagePath }).run();

    return NextResponse.json({
      id: photoId,
      finding_id: findingId,
      storage_path: storagePath,
      url: `/api/photos/${saved.filename}`,
    });
  } catch (error) {
    console.error("POST /api/finding-photos error:", error);
    return NextResponse.json({ error: "Грешка при качване на снимка" }, { status: 500 });
  }
});

// GET — list photos for a finding (or all, scoped by права)
export const GET = withAuth({}, async (request, { session }) => {
  try {
    const url = new URL(request.url);
    const findingId = url.searchParams.get("finding_id");

    if (findingId) {
      // Веригата finding_photos.finding_id → findings.property_id → properties
      // → canViewProperty, както в findings/route.ts.
      const finding = db
        .select({ property_id: findings.property_id })
        .from(findings)
        .where(eq(findings.id, findingId))
        .get();

      if (!finding) {
        // 404, не 400 — не издаваме дали finding_id съществува
        return NextResponse.json(
          { error: "Констатацията не е намерена" },
          { status: 404 }
        );
      }

      const property = db
        .select()
        .from(properties)
        .where(eq(properties.id, finding.property_id))
        .get();

      if (!property || !canAccessProperty(session, property)) {
        // 404, не 403 — не издаваме, че констатацията съществува
        return NextResponse.json(
          { error: "Констатацията не е намерена" },
          { status: 404 }
        );
      }

      const photos = db
        .select()
        .from(findingPhotos)
        .where(eq(findingPhotos.finding_id, findingId))
        .all();

      return NextResponse.json(
        photos.map((p) => ({
          id: p.id,
          finding_id: p.finding_id,
          storage_path: p.storage_path,
          url: `/api/photos/${p.storage_path.split("/").pop() || p.storage_path}`,
          taken_at: p.taken_at,
        }))
      );
    }

    // Без finding_id — снимките по видимите за потребителя констатации
    // (констатация → имот): админ — всички; инспектор — по имотите, до
    // които има достъп; клиент — по своите имоти.
    const scope = propertyScope(session);
    const scopedPhotos =
      session.role === "admin"
        ? db.select().from(findingPhotos).all()
        : db
            .select({
              id: findingPhotos.id,
              finding_id: findingPhotos.finding_id,
              storage_path: findingPhotos.storage_path,
              taken_at: findingPhotos.taken_at,
              property_id: properties.id,
              owner_id: properties.owner_id,
              assigned_inspector_id: properties.assigned_inspector_id,
            })
            .from(findingPhotos)
            .innerJoin(findings, eq(findingPhotos.finding_id, findings.id))
            .innerJoin(properties, eq(findings.property_id, properties.id))
            .all()
            .filter((p) => canViewProperty(session, { id: p.property_id, owner_id: p.owner_id, assigned_inspector_id: p.assigned_inspector_id }, scope));

    return NextResponse.json(
      scopedPhotos.map((p) => ({
        id: p.id,
        finding_id: p.finding_id,
        storage_path: p.storage_path,
        url: `/api/photos/${p.storage_path.split("/").pop() || p.storage_path}`,
        taken_at: p.taken_at,
      }))
    );
  } catch (error) {
    console.error("GET /api/finding-photos error:", error);
    return NextResponse.json(
      { error: "Грешка при зареждане на снимки" },
      { status: 500 }
    );
  }
});
