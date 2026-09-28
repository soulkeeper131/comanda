import { db } from "@/db";
import { notifications, properties, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { sendPushToUsers } from "@/lib/push";

export type NotificationType =
  | "job_started"
  | "job_done"
  | "finding_new"
  | "offer_new"
  | "offer_decided"
  | "finding_urgent"
  | "quote_requested"
  | "property_pending"
  | "property_decided"
  | "plan_requested"
  | "plan_scheduled"
  | "job_rescheduled";

/**
 * Insert an in-app notification for a specific user.
 * Fire-and-forget — errors are logged, never thrown.
 */
export function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body?: string,
  link?: string,
) {
  try {
    db.insert(notifications)
      .values({
        user_id: userId,
        type,
        title,
        body: body || null,
        read: false,
        link: link || null,
      })
      .run();
    // Същото известие и като push на устройствата на този потребител.
    void sendPushToUsers([userId], title, body || "", link || "/dashboard");
  } catch (e) {
    console.error("[notifications] Failed to create:", e);
  }
}

/**
 * Create a notification for the owner of a property.
 * Looks up the owner_id from the properties table.
 */
export function notifyOwner(
  propertyId: string,
  type: NotificationType,
  title: string,
  body?: string,
  link?: string,
) {
  try {
    const prop = db
      .select({ owner_id: properties.owner_id })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .get();
    if (prop?.owner_id) {
      createNotification(prop.owner_id, type, title, body, link);
    }
  } catch (e) {
    console.error("[notifications] Failed to notify owner:", e);
  }
}

/** Известие до всички активни админи (2–3 души с еднакви права — въпрос 29). */
export function notifyAdmins(
  type: NotificationType,
  title: string,
  body?: string,
  link?: string,
) {
  try {
    const admins = db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "admin"), eq(users.active, true)))
      .all();
    for (const a of admins) createNotification(a.id, type, title, body, link);
  } catch (e) {
    console.error("[notifications] Failed to notify admins:", e);
  }
}
