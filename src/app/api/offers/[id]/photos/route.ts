import { db } from "@/db";
import { offers, offerPhotos } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { uploadedFileExists } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/**
 * POST /api/offers/[id]/photos — админът прикача снимки от майстора към
 * ремонта (въпрос 23). Файлът първо се качва през /api/upload.
 * Body: { storage_path }
 */
export const POST = withAuth({ role: ["admin"] }, async (request, { session, params }) => {
  try {
    const offer = db.select().from(offers).where(eq(offers.id, params.id)).get();
    if (!offer) {
      return NextResponse.json({ error: "Офертата не е намерена" }, { status: 404 });
    }
    const body = await request.json().catch(() => ({}));
    const storagePath = typeof body.storage_path === "string" ? body.storage_path : "";
    if (!uploadedFileExists(storagePath)) {
      return NextResponse.json({ error: "Снимката не е качена" }, { status: 400 });
    }

    const [photo] = db
      .insert(offerPhotos)
      .values({ offer_id: offer.id, storage_path: storagePath, uploaded_by: session.uid })
      .returning()
      .all();
    return NextResponse.json(photo, { status: 201 });
  } catch (error) {
    console.error("POST /api/offers/[id]/photos error:", error);
    return NextResponse.json({ error: "Грешка при прикачване на снимка" }, { status: 500 });
  }
});
