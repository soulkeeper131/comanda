import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { withAuth, canViewProperty } from "@/lib/auth";
import { propertyIdForPhoto } from "@/lib/domain/photos";

export const dynamic = "force-dynamic";

const PHOTOS_DIR = path.join(process.cwd(), "data", "photos");

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export const GET = withAuth({}, async (_request, { session, params }) => {
  try {
    const { id } = params;

    // Basic path traversal protection
    if (id.includes("..") || id.includes("/") || id.includes("\\")) {
      return NextResponse.json(
        { error: "Невалиден идентификатор" },
        { status: 400 },
      );
    }

    // Веригата snimka → evidence/finding_photos → job/finding → property_id
    // → canViewProperty, както в evidence/route.ts и finding-photos/route.ts.
    const propertyId = propertyIdForPhoto(id);
    if (!propertyId) {
      return NextResponse.json(
        { error: "Файлът не е намерен" },
        { status: 404 },
      );
    }

    const property = db
      .select()
      .from(properties)
      .where(eq(properties.id, propertyId))
      .get();

    if (!property || !canViewProperty(session, property)) {
      // 404, не 403 — не издаваме, че снимката съществува
      return NextResponse.json(
        { error: "Файлът не е намерен" },
        { status: 404 },
      );
    }

    const filepath = path.join(PHOTOS_DIR, id);

    if (!existsSync(filepath)) {
      return NextResponse.json(
        { error: "Файлът не е намерен" },
        { status: 404 },
      );
    }

    const ext = path.extname(id).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    const buffer = readFileSync(filepath);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        // private — снимката е лична, публичен кеш (CDN, прокси) не бива
        // да я държи достъпна за чужди сесии
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("GET /api/photos/[id] error:", error);
    return NextResponse.json(
      { error: "Грешка при зареждане на файл" },
      { status: 500 },
    );
  }
});
