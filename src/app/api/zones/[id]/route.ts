import { db } from "@/db";
import { zones, properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { withAuth, canViewProperty } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const PATCH = withAuth({}, async (request, { session, params }) => {
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

    // Зоната принадлежи на имот — правата се проверяват през родителя.
    const property = db.select().from(properties).where(eq(properties.id, existing.property_id)).get();
    if (!property || !canViewProperty(session, property)) {
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
});

export const DELETE = withAuth({}, async (_request, { session, params }) => {
  try {
    const { id } = params;

    const existing = db.select().from(zones).where(eq(zones.id, id)).get();
    if (!existing) {
      return NextResponse.json(
        { error: "Зоната не е намерена" },
        { status: 404 }
      );
    }

    // Зоната принадлежи на имот — правата се проверяват през родителя.
    const property = db.select().from(properties).where(eq(properties.id, existing.property_id)).get();
    if (!property || !canViewProperty(session, property)) {
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
});
