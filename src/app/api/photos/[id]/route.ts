import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const PHOTOS_DIR = path.join(process.cwd(), "data", "photos");

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;

    // Basic path traversal protection
    if (id.includes("..") || id.includes("/") || id.includes("\\")) {
      return NextResponse.json(
        { error: "Невалиден идентификатор" },
        { status: 400 },
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

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("GET /api/photos/[id] error:", error);
    return NextResponse.json(
      { error: "Грешка при зареждане на файл" },
      { status: 500 },
    );
  }
}
