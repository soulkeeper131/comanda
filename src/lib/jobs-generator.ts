import { db } from "@/db";
import { jobs, jobReschedules, plans, properties, packages, packageItems, serviceTemplates, users } from "@/db/schema";
import { and, eq, gt, inArray, isNotNull } from "drizzle-orm";
import { scheduleVisits, genKey } from "@/lib/domain/schedule";
import { notify } from "@/lib/messages";

type Tx = Pick<typeof db, "select" | "delete">;

/** Днешната дата в България ("YYYY-MM-DD") — графикът е по местен ден. */
export function todaySofia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Sofia" }).format(now);
}

type Stream = { templateId: string; perMonth: number };

/**
 * Кои услуги генерира планът: ядрото + избраните опции. Опциите идват от
 * снимката при заявката (options_snapshot) — промяна в каталога не пипа
 * вече платен абонамент. Стари планове без снимка четат пакета.
 */
function streamsForPlan(plan: typeof plans.$inferSelect): Stream[] {
  const streams: Stream[] = [{ templateId: plan.template_id, perMonth: plan.per_month ?? 1 }];

  if (plan.options_snapshot) {
    try {
      const snap = JSON.parse(plan.options_snapshot) as { template_id?: unknown; per_month?: unknown }[];
      for (const o of Array.isArray(snap) ? snap : []) {
        if (typeof o.template_id === "string") streams.push({ templateId: o.template_id, perMonth: Number(o.per_month) || 1 });
      }
    } catch {
      /* повредена снимка — само ядрото */
    }
    return streams;
  }

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
export function generateForPlan(planId: string, today = todaySofia(), opts: { announce?: boolean } = {}): number {
  const plan = db.select().from(plans).where(eq(plans.id, planId)).get();
  if (!plan || !plan.first_job_at) return 0;
  if (plan.status === "requested" || plan.status === "pending_payment") return 0;
  if (plan.status === "cancelled" && !plan.ends_at) return 0;

  const property = db.select().from(properties).where(eq(properties.id, plan.property_id)).get();
  if (!property || property.archived || property.status !== "active") return 0;

  // Сезонът — от снимката в плана; за стари планове — от пакета.
  const pkg = plan.package_id && !plan.season_from
    ? db.select().from(packages).where(eq(packages.id, plan.package_id)).get()
    : undefined;
  const season = plan.season_from
    ? { from: plan.season_from, to: plan.season_to }
    : pkg
      ? { from: pkg.active_from, to: pkg.active_to }
      : undefined;

  // Деактивиран инспектор не получава нови обходи — остават невъзложени и
  // се виждат в опашката на админа.
  const inspector = property.assigned_inspector_id
    ? db.select({ id: users.id, active: users.active }).from(users).where(eq(users.id, property.assigned_inspector_id)).get()
    : undefined;
  const assignee = inspector && inspector.active !== false ? inspector.id : null;

  let created = 0;
  for (const stream of streamsForPlan(plan)) {
    const template = db.select().from(serviceTemplates).where(eq(serviceTemplates.id, stream.templateId)).get();
    if (!template) continue;

    const visits = scheduleVisits({
      firstDate: plan.first_job_at.slice(0, 10),
      perMonth: stream.perMonth,
      today,
      endsAt: plan.ends_at,
      season,
    });

    for (const visit of visits) {
      const inserted = db
        .insert(jobs)
        .values({
          org_id: property.org_id,
          property_id: property.id,
          plan_id: plan.id,
          template_id: template.id,
          assignee_id: assignee,
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

  // Само при насрочване на абонамента — не всеки път, когато периодичните
  // задачи удължават графика с още седмица (иначе инспекторът получава
  // „Нови обходи" всеки ден).
  if (opts.announce && created > 0 && assignee) {
    void notify("visits_generated", {
      to: assignee,
      vars: { count: `${created} ${created === 1 ? "обход" : "обхода"}`, property: property.name },
    });
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
export function removePlannedJobsAfter(planId: string, endsAt: string, tx: Tx = db): number {
  const ids = tx
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.plan_id, planId), eq(jobs.status, "planned"), gt(jobs.planned_at, endsAt.slice(0, 10) + "T99")))
    .all()
    .map((j) => j.id);
  if (ids.length === 0) return 0;
  // Историята на преместванията сочи към задачите — първо тя.
  tx.delete(jobReschedules).where(inArray(jobReschedules.job_id, ids)).run();
  return tx.delete(jobs).where(inArray(jobs.id, ids)).run().changes;
}
