import { db } from "@/db";
import { notifications, properties } from "@/db/schema";
import { eq } from "drizzle-orm";

export type NotificationType =
  | "job_started"
  | "job_done"
  | "finding_new"
  | "offer_new"
  | "offer_decided";

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
