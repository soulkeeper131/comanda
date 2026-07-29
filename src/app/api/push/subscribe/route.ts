import { NextResponse } from "next/server";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface PushSubscriptionJSON {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export async function POST(request: Request) {
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

    // Extract user_id from auth session if available
    // For now we store without user_id until auth middleware is wired
    const userAgent = request.headers.get("user-agent") || undefined;

    db.insert(pushSubscriptions)
      .values({
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
}
