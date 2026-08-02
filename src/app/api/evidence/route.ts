import { db } from "@/db";
import { evidence, jobItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("job_id");
    const jobItemId = searchParams.get("job_item_id");

    if (!jobId && !jobItemId) {
      return NextResponse.json(
        { error: "job_id или job_item_id е задължително" },
        { status: 400 }
      );
    }

    let query = db
      .select({
        id: evidence.id,
        job_id: evidence.job_id,
        job_item_id: evidence.job_item_id,
        storage_path: evidence.storage_path,
        taken_at: evidence.taken_at,
        lat: evidence.lat,
        lng: evidence.lng,
        item_label: jobItems.label,
        item_zone_label: jobItems.zone_label,
      })
      .from(evidence)
      .leftJoin(jobItems, eq(evidence.job_item_id, jobItems.id));

    if (jobId) {
      query = query.where(eq(evidence.job_id, jobId));
    }
    if (jobItemId) {
      query = query.where(eq(evidence.job_item_id, jobItemId));
    }

    const rows = query.all();
    return NextResponse.json(rows);
  } catch (error) {
    console.error("GET /api/evidence error:", error);
    return NextResponse.json(
      { error: "Грешка при зареждане на доказателства" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { job_id, job_item_id, storage_path, lat, lng } = body;

    if (!job_id || !storage_path) {
      return NextResponse.json(
        { error: "Задача и път до файл са задължителни" },
        { status: 400 }
      );
    }

    const [record] = db
      .insert(evidence)
      .values({
        job_id,
        job_item_id: job_item_id || null,
        storage_path,
        lat: lat ?? null,
        lng: lng ?? null,
      })
      .returning();

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error("POST /api/evidence error:", error);
    return NextResponse.json({ error: "Грешка при записване на доказателство" }, { status: 500 });
  }
}
