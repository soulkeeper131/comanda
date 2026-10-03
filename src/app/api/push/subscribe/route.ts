import { NextResponse } from "next/server";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { withAuth } from "@/lib/auth";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { isAllowedPushEndpoint, isValidPushKeys } from "@/lib/domain/push-endpoint";

export const dynamic = "force-dynamic";

const MAX_DEVICES = 10;

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

    if (!subscription || !isAllowedPushEndpoint(subscription.endpoint) || !isValidPushKeys(subscription.keys)) {
      return NextResponse.json({ error: "Невалиден абонамент за известия" }, { status: 400 });
    }
    // Записваме само познатите полета — не каквото е дошло.
    const clean = {
      endpoint: subscription.endpoint,
      expirationTime: typeof subscription.expirationTime === "number" ? subscription.expirationTime : null,
      keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    };

    // Същото устройство (endpoint) — търсим го в базата, без да четем всички.
    const needle = `"endpoint":${JSON.stringify(clean.endpoint)}`;
    const alreadySubscribed = db
      .select()
      .from(pushSubscriptions)
      .where(sql`instr(${pushSubscriptions.subscription}, ${needle}) > 0`)
      .get();

    // Едно устройство — един получател: последният влязъл. Иначе на споделен
    // телефон/компютър известията на предишния потребител идват при новия,
    // а неговите собствени — никъде.
    if (alreadySubscribed) {
      db.update(pushSubscriptions)
        .set({ user_id: session.uid, subscription: JSON.stringify(clean) })
        .where(eq(pushSubscriptions.id, alreadySubscribed.id))
        .run();
      return NextResponse.json({ success: true, existed: true });
    }

    const userAgent = request.headers.get("user-agent")?.slice(0, 300) || undefined;

    db.insert(pushSubscriptions)
      .values({
        user_id: session.uid,
        subscription: JSON.stringify(clean),
        user_agent: userAgent,
      })
      .run();

    // До 10 устройства на човек — най-старите отпадат.
    const mine = db
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.user_id, session.uid))
      .orderBy(desc(pushSubscriptions.created_at))
      .all();
    if (mine.length > MAX_DEVICES) {
      db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, mine.slice(MAX_DEVICES).map((m) => m.id))).run();
    }

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
