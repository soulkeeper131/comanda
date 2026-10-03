import webpush from "web-push";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { isAllowedPushEndpoint } from "@/lib/domain/push-endpoint";

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
    "mailto:admin@comanda.bg",
    publicKey,
    privateKey
  );

  webpushInitialized = true;
}

export function isPushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

/**
 * Push само до устройствата на конкретни потребители. За разлика от
 * sendPushToAll не издава чужди имоти/адреси на други клиенти.
 */
export async function sendPushToUsers(
  userIds: string[],
  title: string,
  body: string,
  url: string = "/dashboard",
  opts: { urgent?: boolean } = {},
) {
  if (!isPushConfigured() || userIds.length === 0) return;
  try {
    ensureWebpushConfigured();
    const subs = db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.user_id, userIds)).all();
    // Собствен tag за всяко известие — иначе новото заменя предишното на
    // телефона и спешен сигнал може да бъде изтрит от следващото известие.
    const payload = JSON.stringify({ title, body, url, tag: crypto.randomUUID(), urgent: !!opts.urgent });
    for (const row of subs) {
      try {
        const sub = JSON.parse(row.subscription);
        // Само към push услугите на браузърите (виж push-endpoint.ts).
        if (!isAllowedPushEndpoint(sub?.endpoint)) {
          db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, row.id)).run();
          continue;
        }
        await webpush.sendNotification(sub, payload);
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, row.id)).run();
        } else {
          console.error("[push] send failed:", err?.statusCode ?? "", err?.body ?? err?.message ?? err);
        }
      }
    }
  } catch (error) {
    console.error("sendPushToUsers error:", error);
  }
}

