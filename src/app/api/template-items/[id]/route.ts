import { db } from "@/db";
import { templateItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { parseStepInput } from "@/lib/domain/templates";

export const dynamic = "force-dynamic";

export const PATCH = withAuth({ role: ["admin"] }, async (request, { params }) => {
  try {
    const { id } = params;
    const body = await request.json().catch(() => null);

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

    const parsed = parseStepInput(body, { create: false });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const updates = parsed.value;

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
});

export const DELETE = withAuth({ role: ["admin"] }, async (_request, { params }) => {
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
});
