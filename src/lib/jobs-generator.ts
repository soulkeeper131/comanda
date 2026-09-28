import { db } from "@/db";
import { jobs, plans, properties, packages, packageItems, serviceTemplates } from "@/db/schema";
import { and, eq, gt, inArray, isNotNull } from "drizzle-orm";
import { scheduleVisits, genKey } from "@/lib/domain/schedule";
import { createNotification } from "@/lib/notifications";

/** Днешната дата в България ("YYYY-MM-DD") — графикът е по местен ден. */
export function todaySofia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Sofia" }).format(now);
}

type Stream = { templateId: string; perMonth: number };

/** Кои услуги генерира планът: ядрото + избраните опции от пакета. */
function streamsForPlan(plan: typeof plans.$inferSelect): Stream[] {
  const streams: Stream[] = [{ templateId: plan.template_id, perMonth: plan.per_month ?? 1 }];
  if (!plan.package_id || !plan.options) return streams;

  let optionIds: string[] = [];
  try {
    const parsed = JSON.parse(plan.options);
    if (Array.isArray(parsed)) optionIds = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return streams;
  }
  if (optionIds.length === 0) return streams;

  const items = db
    .select()
    .from(packageItems)
    .where(and(eq(packageItems.package_id, plan.package_id), inArray(packageItems.id, optionIds)))
    .all();
  for (const item of items) {
    if (item.optional) streams.push({ templateId: item.template_id, perMonth: item.per_month });
  }
  return streams;
}

export type GenerateResult = { plans: number; created: number };

/**
 * Създава липсващите обходи за един план до хоризонта (три месеца).
 * Идемпотентно: ключът е (план, услуга, поредност) с UNIQUE индекс —
 * второ пускане не дублира, а преместена от клиента задача не се пипа.
 */
export function generateForPlan(planId: string, today = todaySofia()): number {
  const plan = db.select().from(plans).where(eq(plans.id, planId)).get();
  if (!plan || !plan.first_job_at) return 0;
  if (plan.status === "requested") return 0;
  if (plan.status === "cancelled" && !plan.ends_at) return 0;

  const property = db.select().from(properties).where(eq(properties.id, plan.property_id)).get();
  if (!property || property.archived || property.status !== "active") return 0;

  const pkg = plan.package_id
    ? db.select().from(packages).where(eq(packages.id, plan.package_id)).get()
    : undefined;

  let created = 0;
  for (const stream of streamsForPlan(plan)) {
    const template = db.select().from(serviceTemplates).where(eq(serviceTemplates.id, stream.templateId)).get();
    if (!template) continue;

    const visits = scheduleVisits({
      firstDate: plan.first_job_at.slice(0, 10),
      perMonth: stream.perMonth,
      today,
      endsAt: plan.ends_at,
      season: pkg ? { from: pkg.active_from, to: pkg.active_to } : undefined,
    });

    for (const visit of visits) {
      const inserted = db
        .insert(jobs)
        .values({
          org_id: property.org_id,
          property_id: property.id,
          plan_id: plan.id,
          template_id: template.id,
          assignee_id: property.assigned_inspector_id ?? null,
          title: `${template.name} — ${property.name}`,
          duration_min: template.duration_min,
          planned_at: visit.date,
          status: "planned",
          gen_key: genKey(plan.id, template.id, visit.seq),
        })
        .onConflictDoNothing({ target: jobs.gen_key })
        .run();
      created += inserted.changes;
    }
  }

  if (created > 0 && property.assigned_inspector_id) {
    createNotification(
      property.assigned_inspector_id,
      "job_started",
      "Нови обходи в графика",
      `${created} ${created === 1 ? "обход" : "обхода"} — ${property.name}`,
      "/dashboard",
    );
  }
  return created;
}

/** Всички планове, които имат насрочен първи обход. */
export function generateAll(today = todaySofia()): GenerateResult {
  const rows = db
    .select({ id: plans.id })
    .from(plans)
    .where(and(isNotNull(plans.first_job_at), inArray(plans.status, ["active", "cancelled"])))
    .all();
  let created = 0;
  for (const row of rows) created += generateForPlan(row.id, today);
  return { plans: rows.length, created };
}

/**
 * Отказ на абонамент (въпрос 5): планът работи до края на платения период,
 * а вече генерираните задачи СЛЕД него се трият. Пипат се само `planned` —
 * започнатите и завършените са история.
 */
export function removePlannedJobsAfter(planId: string, endsAt: string): number {
  const res = db
    .delete(jobs)
    .where(and(eq(jobs.plan_id, planId), eq(jobs.status, "planned"), gt(jobs.planned_at, endsAt.slice(0, 10) + "T99")))
    .run();
  return res.changes;
}
