import { db } from "@/db";
import { offers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// PATCH /api/offers/[id] — обновява оферта (decision, scope, price, days)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    // Check offer exists
    const [existing] = await db
      .select()
      .from(offers)
      .where(eq(offers.id, id));
    if (!existing) {
      return NextResponse.json(
        { error: "Офертата не е намерена" },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};

    if (body.decision !== undefined) {
      if (!["pending", "accepted", "declined"].includes(body.decision)) {
        return NextResponse.json(
          { error: "Невалиден статус. Позволени: pending, accepted, declined" },
          { status: 400 }
        );
      }
      updates.decision = body.decision;
    }

    if (body.scope !== undefined) {
      updates.scope = body.scope;
    }

    if (body.price !== undefined) {
      updates.price = parseFloat(body.price);
    }

    if (body.days !== undefined) {
      updates.days = parseInt(body.days, 10);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Няма полета за обновяване" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(offers)
      .set(updates)
      .where(eq(offers.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/offers/[id] error:", error);
    return NextResponse.json(
      { error: "Грешка при обновяване на оферта" },
      { status: 500 }
    );
  }
}

// DELETE /api/offers/[id] — изтрива оферта (само ако е pending)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const [existing] = await db
      .select()
      .from(offers)
      .where(eq(offers.id, id));
    if (!existing) {
      return NextResponse.json(
        { error: "Офертата не е намерена" },
        { status: 404 }
      );
    }

    if (existing.decision !== "pending") {
      return NextResponse.json(
        { error: "Може да се изтрие само оферта със статус 'pending'" },
        { status: 400 }
      );
    }

    await db.delete(offers).where(eq(offers.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/offers/[id] error:", error);
    return NextResponse.json(
      { error: "Грешка при изтриване на оферта" },
      { status: 500 }
    );
  }
}
