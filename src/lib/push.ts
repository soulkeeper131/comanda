import webpush from "web-push";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";

export function getVapidKeys() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env.local");
  }

  return { publicKey, privateKey };
}

let webpushInitialized = false;

export function ensureWebpushConfigured() {
  if (webpushInitialized) return;

  const { publicKey, privateKey } = getVapidKeys();

  webpush.setVapidDetails(
    "mailto:admin@comanda.blv.bg",
    publicKey,
    privateKey
  );

  webpushInitialized = true;
}

/**
 * Изпраща push нотификация до всички абонирани устройства.
 * Може да се вика директно от API routes (без междинен HTTP call).
 */
export async function sendPushToAll(title: string, body: string, url: string = "/") {
  try {
    ensureWebpushConfigured();

    const subs = db.select().from(pushSubscriptions).all();

    if (subs.length === 0) return;

    const payload = JSON.stringify({ title, body, url });

    for (const row of subs) {
      try {
        const subscription = JSON.parse(row.subscription);
        await webpush.sendNotification(subscription, payload);
      } catch (err: any) {
        console.error(`Push failed for subscription ${row.id}:`, err.message || err);

        if (err.statusCode === 410 || err.statusCode === 404) {
          try {
            db.delete(pushSubscriptions)
              .where(eq(pushSubscriptions.id, row.id))
              .run();
          } catch (cleanupErr) {
            console.error("Failed to clean up expired subscription:", cleanupErr);
          }
        }
      }
    }
  } catch (error) {
    // Не fail-ваме основната операция заради push
    console.error("sendPushToAll error:", error);
  }
}
