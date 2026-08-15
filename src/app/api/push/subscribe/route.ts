import { NextResponse } from "next/server";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { withAuth } from "@/lib/auth";

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

    if (alreadySubscribed) {
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
