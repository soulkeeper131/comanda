import { db } from "@/db";
import { notifications } from "@/db/schema";
import { withAuth } from "@/lib/auth";
import { eq, desc, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/notifications — връща нотификациите за текущия user
// GET /api/notifications?all=true — връща всички (и прочетени)
// GET /api/notifications?limit=10 — лимит
export const GET = withAuth({}, async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const showAll = searchParams.get("all") === "true";
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const query = db
      .select()
      .from(notifications)
      .where(
        showAll
          ? eq(notifications.user_id, session.uid)
          : and(
              eq(notifications.user_id, session.uid),
              eq(notifications.read, false),
            ),
      )
      .orderBy(desc(notifications.created_at))
      .limit(limit);

    const rows = query.all();

    // Count unread
    const unreadCount = db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.user_id, session.uid),
          eq(notifications.read, false),
        ),
      )
      .all().length;

    return NextResponse.json({ notifications: rows, unreadCount });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json(
      { error: "Грешка при зареждане на нотификации" },
      { status: 500 },
    );
  }
});

// PATCH /api/notifications — маркира нотификация(и) като прочетени
// Body: { id: string } — single, or { ids: string[] } — multiple, or { markAllRead: true }
export const PATCH = withAuth({}, async (request, { session }) => {
  try {
    const body = await request.json();

    if (body.markAllRead) {
      db.update(notifications)
        .set({ read: true })
        .where(
          and(
            eq(notifications.user_id, session.uid),
            eq(notifications.read, false),
          ),
        )
        .run();
      return NextResponse.json({ success: true });
    }

    if (body.id) {
      db.update(notifications)
        .set({ read: true })
        .where(
          and(
            eq(notifications.id, body.id),
            eq(notifications.user_id, session.uid),
          ),
        )
        .run();
      return NextResponse.json({ success: true });
    }

    if (body.ids && Array.isArray(body.ids)) {
      for (const id of body.ids) {
        db.update(notifications)
          .set({ read: true })
          .where(
            and(
              eq(notifications.id, id),
              eq(notifications.user_id, session.uid),
            ),
          )
          .run();
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Няма посочени нотификации за маркиране" },
      { status: 400 },
    );
  } catch (error) {
    console.error("PATCH /api/notifications error:", error);
    return NextResponse.json(
      { error: "Грешка при обновяване на нотификации" },
      { status: 500 },
    );
  }
});
