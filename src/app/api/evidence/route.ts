import { db } from "@/db";
import { evidence } from "@/db/schema";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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
