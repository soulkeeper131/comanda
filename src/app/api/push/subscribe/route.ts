import { NextResponse } from "next/server";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { withAuth } from "@/lib/auth";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface PushSubscriptionJSON {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export const POST = withAuth({}, async (request, { session }) => {
  try {
    const body = await request.json();
    const { subscription } = body as { subscription: PushSubscriptionJSON };

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json(
        { error: "Invalid subscription object" },
        { status: 400 }
      );
    }

    // Check if this endpoint already exists
    const all = db.select().from(pushSubscriptions).all();

    const alreadySubscribed = all.find((s) => {
      try {
        const parsed = JSON.parse(s.subscription);
        return parsed.endpoint === subscription.endpoint;
      } catch {
        return false;
      }
    });

    // Едно устройство — един получател: последният влязъл. Иначе на споделен
    // телефон/компютър известията на предишния потребител идват при новия,
    // а неговите собствени — никъде.
    if (alreadySubscribed) {
      db.update(pushSubscriptions)
        .set({ user_id: session.uid, subscription: JSON.stringify(subscription) })
        .where(eq(pushSubscriptions.id, alreadySubscribed.id))
        .run();
      return NextResponse.json({ success: true, existed: true });
    }

    const userAgent = request.headers.get("user-agent") || undefined;

    db.insert(pushSubscriptions)
      .values({
        user_id: session.uid,
        subscription: JSON.stringify(subscription),
        user_agent: userAgent,
      })
      .run();

    return NextResponse.json({ success: true, existed: false }, { status: 201 });
  } catch (error) {
    console.error("POST /api/push/subscribe error:", error);
    return NextResponse.json(
      { error: "Failed to save subscription" },
      { status: 500 }
    );
  }
});

/**
 * DELETE { endpoint } — това устройство спира да получава известия за
 * текущия потребител (изключване от камбанката или изход от профила).
 */
export const DELETE = withAuth({}, async (request, { session }) => {
  const body = await request.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) return NextResponse.json({ error: "Липсва endpoint" }, { status: 400 });
  const mine = db.select().from(pushSubscriptions).where(eq(pushSubscriptions.user_id, session.uid)).all();
  for (const row of mine) {
    try {
      if (JSON.parse(row.subscription).endpoint === endpoint) {
        db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.id, row.id), eq(pushSubscriptions.user_id, session.uid))).run();
      }
    } catch {
      /* повреден запис — пропускаме */
    }
  }
  return NextResponse.json({ success: true });
});
