import { NextResponse } from "next/server";
import { db } from "@/db";
import { findingPhotos, findings, properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";
import { withAuth, canViewProperty } from "@/lib/auth";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(process.cwd(), "data", "photos");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

function getExtension(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": ".jpg",
    ".jpeg": ".jpeg",
    ".png": ".png",
    ".webp": ".webp",
    ".gif": ".gif",
  };
  return map[ext] || ext || ".jpg";
}

// POST — upload a photo for a finding
export const POST = withAuth({ role: ["admin", "inspector"] }, async (request) => {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const findingId = formData.get("finding_id")?.toString();

    if (!findingId) {
      return NextResponse.json(
        { error: "Липсва finding_id" },
        { status: 400 }
      );
    }

    // Verify finding exists
    const finding = db
      .select()
      .from(findings)
      .where(eq(findings.id, findingId))
      .get();

    if (!finding) {
      return NextResponse.json(
        { error: "Констатацията не е намерена" },
        { status: 404 }
      );
    }

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Липсва файл" },
        { status: 400 }
      );
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Файлът е твърде голям (макс 10 MB)" },
        { status: 400 }
      );
    }

    // Check file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Непозволен тип файл. Позволени: JPEG, PNG, WebP, GIF" },
        { status: 400 }
      );
    }

    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    const ext = getExtension(file.name);
    const filename = `${crypto.randomUUID()}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    const storagePath = `data/photos/${filename}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    // Insert photo record
    const photoId = crypto.randomUUID();
    db.insert(findingPhotos)
      .values({
        id: photoId,
        finding_id: findingId,
        storage_path: storagePath,
      })
      .run();

    return NextResponse.json({
      id: photoId,
      finding_id: findingId,
      storage_path: storagePath,
      url: `/api/photos/${filename}`,
    });
  } catch (error) {
    console.error("POST /api/finding-photos error:", error);
    return NextResponse.json(
      { error: "Грешка при качване на снимка" },
      { status: 500 }
    );
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

      if (!property || !canViewProperty(session, property)) {
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

    // Без finding_id — връщаме всички снимки, скопирани по видимите за
    // потребителя констатации (веригата constatация → имот → canViewProperty),
    // с една заявка вместо да теглим findings/properties/photos изцяло в паметта.
    // admin/inspector виждат всичко — директна заявка без join по собственик.
    // client вижда само снимки на констатации от собствените си имоти.
    const scopedPhotos =
      session.role === "admin" || session.role === "inspector"
        ? db.select().from(findingPhotos).all()
        : db
            .select({
              id: findingPhotos.id,
              finding_id: findingPhotos.finding_id,
              storage_path: findingPhotos.storage_path,
              taken_at: findingPhotos.taken_at,
            })
            .from(findingPhotos)
            .innerJoin(findings, eq(findingPhotos.finding_id, findings.id))
            .innerJoin(properties, eq(findings.property_id, properties.id))
            .where(eq(properties.owner_id, session.uid))
            .all();

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
