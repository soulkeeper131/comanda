import { NextResponse } from "next/server";
import webpush from "web-push";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureWebpushConfigured } from "@/lib/push";

export const dynamic = "force-dynamic";

interface SendPushBody {
  title: string;
  body: string;
  url?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SendPushBody;

    if (!body.title || !body.body) {
      return NextResponse.json(
        { error: "title and body are required" },
        { status: 400 }
      );
    }

    ensureWebpushConfigured();

    // Load all subscriptions from DB
    const subs = db.select().from(pushSubscriptions).all();

    if (subs.length === 0) {
      return NextResponse.json({
        sent: 0,
        failed: 0,
        message: "No subscriptions found",
      });
    }

    const payload = JSON.stringify({
      title: body.title,
      body: body.body,
      url: body.url || "/",
    });

    let sent = 0;
    let failed = 0;

    for (const row of subs) {
      try {
        const subscription = JSON.parse(row.subscription);
        await webpush.sendNotification(subscription, payload);
        sent++;
      } catch (err: any) {
        failed++;
        console.error(
          `Push failed for subscription ${row.id}:`,
          err.message || err
        );

        // Remove expired/unsubscribed endpoints (410 Gone / 404 Not Found)
        if (err.statusCode === 410 || err.statusCode === 404) {
          try {
            db.delete(pushSubscriptions)
              .where(eq(pushSubscriptions.id, row.id))
              .run();
          } catch (cleanupErr) {
            console.error(
              "Failed to clean up expired subscription:",
              cleanupErr
            );
          }
        }
      }
    }

    return NextResponse.json({ sent, failed });
  } catch (error) {
    console.error("POST /api/push/send error:", error);
    return NextResponse.json(
      { error: "Failed to send push notifications" },
      { status: 500 }
    );
  }
}
