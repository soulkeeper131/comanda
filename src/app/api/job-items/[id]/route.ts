import { db } from "@/db";
import { jobItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const PATCH = withAuth({ role: ["admin", "inspector"] }, async (request, { params }) => {
  try {
    const { id } = params;
    const body = await request.json();
    const { done } = body;

    if (done === undefined) {
      return NextResponse.json(
        { error: "Полето 'done' е задължително" },
        { status: 400 }
      );
    }

    // Check if job item exists
    const item = db.select().from(jobItems).where(eq(jobItems.id, id)).get();
    if (!item) {
      return NextResponse.json({ error: "Стъпката не е намерена" }, { status: 404 });
    }

    db.update(jobItems)
      .set({ done: done ? true : false })
      .where(eq(jobItems.id, id))
      .run();

    const updated = db.select().from(jobItems).where(eq(jobItems.id, id)).get();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/job-items/[id] error:", error);
    return NextResponse.json({ error: "Грешка при обновяване на стъпка" }, { status: 500 });
  }
});
