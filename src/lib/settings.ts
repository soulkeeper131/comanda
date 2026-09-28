import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_PREPAY_THRESHOLD } from "@/lib/domain/offers";

export function getSetting(key: string): string | null {
  try {
    const row = db.select().from(settings).where(eq(settings.key, key)).get();
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export function setSetting(key: string, value: string) {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}

/** Прагът за предплащане на ремонт в евро (въпрос 22б). */
export function getPrepayThreshold(): number {
  const raw = Number(getSetting("prepay_threshold"));
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_PREPAY_THRESHOLD;
}
