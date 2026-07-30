import { db } from "@/db";
import { templateItems } from "@/db/schema";
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

    // Check if item exists
    const item = db
      .select()
      .from(templateItems)
      .where(eq(templateItems.id, id))
      .get();

    if (!item) {
      return NextResponse.json(
        { error: "Елементът не е намерен" },
        { status: 404 }
      );
    }

    // Build update object from allowed fields
    const updates: Record<string, unknown> = {};
    if (body.zone_label !== undefined) updates.zone_label = body.zone_label || null;
    if (body.label !== undefined) updates.label = body.label;
    if (body.proof_type !== undefined) updates.proof_type = body.proof_type;
    if (body.required !== undefined) updates.required = body.required;
    if (body.sort !== undefined) updates.sort = body.sort;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Няма полета за обновяване" },
        { status: 400 }
      );
    }

    db.update(templateItems)
      .set(updates)
      .where(eq(templateItems.id, id))
      .run();

    const updated = db
      .select()
      .from(templateItems)
      .where(eq(templateItems.id, id))
      .get();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/template-items/[id] error:", error);
    return NextResponse.json(
      { error: "Грешка при обновяване на елемент от шаблон" },
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

    const item = db
      .select()
      .from(templateItems)
      .where(eq(templateItems.id, id))
      .get();

    if (!item) {
      return NextResponse.json(
        { error: "Елементът не е намерен" },
        { status: 404 }
      );
    }

    db.delete(templateItems)
      .where(eq(templateItems.id, id))
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/template-items/[id] error:", error);
    return NextResponse.json(
      { error: "Грешка при изтриване на елемент от шаблон" },
      { status: 500 }
    );
  }
}
