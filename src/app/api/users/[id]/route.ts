import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const GET = withAuth({ role: ["admin"] }, async (_request, { params }) => {
  try {
    const { id } = params;
    const user = db.select().from(users).where(eq(users.id, id)).get();

    if (!user) {
      return NextResponse.json({ error: "Потребителят не е намерен" }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      name: user.full_name ?? "",
      email: user.email,
      role: user.role,
      active: user.active ?? true,
    });
  } catch (err) {
    console.error("[USERS GET/:id] Error:", err);
    return NextResponse.json({ error: "Грешка при зареждане на потребител" }, { status: 500 });
  }
});
