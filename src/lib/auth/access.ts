import { db } from "@/db";
import { jobs, properties } from "@/db/schema";
import { and, eq, gte, inArray, or } from "drizzle-orm";
import type { SessionData } from "./session";
import { canViewProperty } from "./policy";

/** Колко дни след завършен обход инспекторът още вижда имота (отчет, снимки). */
const RECENT_DAYS = 30;

/**
 * Имотите, до които инспекторът има достъп: възложените му и тези, където
 * има свой предстоящ, текущ или наскоро завършен обход.
 */
export function inspectorPropertyIds(uid: string, now = new Date()): Set<string> {
  const since = new Date(now.getTime() - RECENT_DAYS * 86_400_000).toISOString();
  const assigned = db.select({ id: properties.id }).from(properties).where(eq(properties.assigned_inspector_id, uid)).all();
  const viaJobs = db
    .selectDistinct({ id: jobs.property_id })
    .from(jobs)
    .where(
      and(
        eq(jobs.assignee_id, uid),
        or(inArray(jobs.status, ["planned", "in_progress"]), and(eq(jobs.status, "completed"), gte(jobs.check_out, since))),
      ),
    )
    .all();
  return new Set([...assigned, ...viaJobs].map((r) => r.id));
}

/** За списъци: множеството имоти на инспектора (за другите роли — няма нужда). */
export function propertyScope(session: SessionData): Set<string> | undefined {
  return session.role === "inspector" ? inspectorPropertyIds(session.uid) : undefined;
}

/** canViewProperty с достъпа на инспектора, изчислен от базата. */
export function canAccessProperty(
  session: SessionData,
  property: { id: string; owner_id: string; assigned_inspector_id?: string | null },
): boolean {
  return canViewProperty(session, property, propertyScope(session));
}
