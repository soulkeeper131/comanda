import { db } from "@/db";
import { zones } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { name, sort } = body;

    const existing = db.select().from(zones).where(eq(zones.id, id)).get();
    if (!existing) {
      return NextResponse.json(
        { error: "Зоната не е намерена" },
        { status: 404 }
      );
    }

    const updates: Partial<typeof zones.$inferInsert> = {};
    if (name !== undefined) updates.name = name.trim();
    if (sort !== undefined) updates.sort = sort;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(existing);
    }

    const [updated] = db
      .update(zones)
      .set(updates)
      .where(eq(zones.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/zones/[id] error:", error);
    return NextResponse.json(
      { error: "Грешка при обновяване на зона" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const existing = db.select().from(zones).where(eq(zones.id, id)).get();
    if (!existing) {
      return NextResponse.json(
        { error: "Зоната не е намерена" },
        { status: 404 }
      );
    }

    db.delete(zones).where(eq(zones.id, id)).run();

    return NextResponse.json({ deleted: id });
  } catch (error) {
    console.error("DELETE /api/zones/[id] error:", error);
    return NextResponse.json(
      { error: "Грешка при изтриване на зона" },
      { status: 500 }
    );
  }
}
