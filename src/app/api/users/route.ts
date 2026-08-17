import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const GET = withAuth({ role: ["admin"] }, async () => {
  try {
    const rows = db.select().from(users).where(eq(users.active, true)).limit(100).all();
    const result = rows.map((u) => ({
      id: u.id,
      name: u.full_name ?? "",
      email: u.email,
      role: u.role,
      active: u.active ?? true,
    }));
    return NextResponse.json({ users: result });
  } catch (err) {
    console.error("[USERS] Error:", err);
    return NextResponse.json({ error: "Грешка при зареждане на потребители" }, { status: 500 });
  }
});

export const PATCH = withAuth({ role: ["admin"] }, async (request) => {
  try {
    const body = await request.json();
    const { id, role, full_name, active } = body;

    if (!id) {
      return NextResponse.json({ error: "ID на потребител е задължително" }, { status: 400 });
    }

    if (role === undefined && full_name === undefined && active === undefined) {
      return NextResponse.json(
        { error: "Поне едно поле за обновяване е задължително (role, full_name, active)" },
        { status: 400 }
      );
    }

    const existing = db.select().from(users).where(eq(users.id, id)).get();
    if (!existing) {
      return NextResponse.json({ error: "Потребителят не е намерен" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (role !== undefined) updates.role = role;
    if (full_name !== undefined) updates.full_name = full_name;
    if (active !== undefined) updates.active = active;

    db.update(users).set(updates).where(eq(users.id, id)).run();

    const updated = db.select().from(users).where(eq(users.id, id)).get();

    return NextResponse.json({
      id: updated!.id,
      name: updated!.full_name ?? "",
      email: updated!.email,
      role: updated!.role,
      active: updated!.active ?? true,
    });
  } catch (err) {
    console.error("[USERS PATCH] Error:", err);
    return NextResponse.json({ error: "Грешка при обновяване на потребител" }, { status: 500 });
  }
});

export const DELETE = withAuth({ role: ["admin"] }, async (request, { session }) => {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "ID на потребител е задължително" }, { status: 400 });
    }

    // Prevent self-deletion
    if (id === session.uid) {
      return NextResponse.json(
        { error: "Не можете да деактивирате собствения си профил" },
        { status: 403 }
      );
    }

    const existing = db.select().from(users).where(eq(users.id, id)).get();
    if (!existing) {
      return NextResponse.json({ error: "Потребителят не е намерен" }, { status: 404 });
    }

    db.update(users)
      .set({ active: false, updated_at: new Date().toISOString() })
      .where(eq(users.id, id))
      .run();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[USERS DELETE] Error:", err);
    return NextResponse.json({ error: "Грешка при деактивиране на потребител" }, { status: 500 });
  }
});
