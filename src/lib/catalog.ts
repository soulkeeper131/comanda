import { db } from "@/db";
import { packages, packageItems, serviceTemplates, templateItems } from "@/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDefaultOrgId } from "@/lib/org";
import { addDays, inSeason } from "@/lib/domain/schedule";
import { todaySofia } from "@/lib/jobs-generator";

export type CatalogItem = {
  id: string;
  template_id: string;
  template_name: string;
  category: string;
  description: string | null;
  per_month: number;
  optional: boolean;
  extra_price: number;
  steps: number;
};

export type CatalogPackage = typeof packages.$inferSelect & {
  in_season: boolean;
  items: CatalogItem[];
};

/** Каталогът с пакетите и какво включва всеки (N5). */
export function loadCatalog(opts: { includeArchived?: boolean } = {}): CatalogPackage[] {
  ensureDefaultCatalog();
  const rows = db
    .select()
    .from(packages)
    .where(opts.includeArchived ? undefined : eq(packages.archived, false))
    .orderBy(asc(packages.sort), asc(packages.price))
    .all();
  if (rows.length === 0) return [];

  const items = db
    .select({ item: packageItems, template: serviceTemplates })
    .from(packageItems)
    .innerJoin(serviceTemplates, eq(packageItems.template_id, serviceTemplates.id))
    .where(inArray(packageItems.package_id, rows.map((p) => p.id)))
    .orderBy(asc(packageItems.sort))
    .all();
  const templateIds = Array.from(new Set(items.map((i) => i.template.id)));
  const steps = templateIds.length
    ? db.select({ template_id: templateItems.template_id }).from(templateItems).where(inArray(templateItems.template_id, templateIds)).all()
    : [];

  const today = todaySofia();
  return rows.map((p) => ({
    ...p,
    // Сезонен пакет се заявява и до 30 дни преди сезона — генераторът и без
    // това създава обходи само в сезона.
    in_season: inSeason(today, p.active_from, p.active_to) || inSeason(addDays(today, 30), p.active_from, p.active_to),
    items: items
      .filter((i) => i.item.package_id === p.id)
      .map(({ item, template }) => ({
        id: item.id,
        template_id: template.id,
        template_name: template.name,
        category: template.category,
        description: template.description,
        per_month: item.optional ? item.per_month : p.per_month,
        optional: Boolean(item.optional),
        extra_price: item.extra_price ?? 0,
        steps: steps.filter((s) => s.template_id === template.id).length,
      })),
  }));
}

/** Ядрото на пакета — задължителната услуга (обходът). */
export function coreItem(pkg: CatalogPackage): CatalogItem | undefined {
  return pkg.items.find((i) => !i.optional);
}

/** Месечна цена на абонамент: цената на пакета + избраните опции. */
export function planPrice(pkg: CatalogPackage, optionIds: string[]): number {
  const extras = pkg.items
    .filter((i) => i.optional && optionIds.includes(i.id))
    .reduce((sum, i) => sum + i.extra_price, 0);
  return Math.round((pkg.price + extras) * 100) / 100;
}

function findOrCreateTemplate(
  orgId: string,
  category: string,
  fallback: { name: string; description: string; duration_min: number; price: number; steps: [string, string][] },
): string {
  const existing = db
    .select({ id: serviceTemplates.id })
    .from(serviceTemplates)
    .where(and(eq(serviceTemplates.category, category), eq(serviceTemplates.archived, false)))
    .orderBy(asc(serviceTemplates.created_at))
    .get();
  if (existing) return existing.id;

  const [tpl] = db
    .insert(serviceTemplates)
    .values({
      org_id: orgId,
      category,
      name: fallback.name,
      description: fallback.description,
      icon: category,
      duration_min: fallback.duration_min,
      price: fallback.price,
      bookable: true,
    })
    .returning()
    .all();
  fallback.steps.forEach(([zone, label], i) => {
    db.insert(templateItems)
      .values({ template_id: tpl.id, zone_label: zone, label, proof_type: "photo", required: true, sort: i + 1 })
      .run();
  });
  return tpl.id;
}

/**
 * Началният каталог — само ако още няма нито един пакет. Цените са
 * отправна точка; админът ги сменя от панела. Замества трите зашити
 * константи, които PlanSelector показваше, без да съществуват в базата.
 */
export function ensureDefaultCatalog() {
  const any = db.select({ id: packages.id }).from(packages).limit(1).get();
  if (any) return;

  let orgId: string;
  try {
    orgId = getDefaultOrgId();
  } catch {
    return; // няма организация — празна база, нищо за правене
  }

  const inspection = findOrCreateTemplate(orgId, "inspection", {
    name: "Технически обход",
    description: "Проверка на ВиК, ел. инсталация, дограма, общо състояние",
    duration_min: 60,
    price: 25,
    steps: [
      ["Входна врата", "Врата и брава — цели, заключено"],
      ["Баня", "Проверка за течове"],
      ["Кухня", "Сифон и смесител — сухо"],
      ["Общо", "Ел. табло — без изключени предпазители"],
      ["Общо", "Дограма и прозорци — затворени, без влага"],
      ["Общо", "Общ изглед на всяко помещение"],
    ],
  });
  const cleaning = findOrCreateTemplate(orgId, "cleaning", {
    name: "Основно почистване",
    description: "Прах, прахосмукачка, мокър под, баня, кухня",
    duration_min: 120,
    price: 40,
    steps: [
      ["Всекидневна", "Прах и под"],
      ["Кухня", "Плот и мивка"],
      ["Баня", "Санитария"],
    ],
  });

  // Същите пакети и цени като на публичната страница (src/app/page.tsx) —
  // клиентът не бива да види една цена там и друга след регистрация.
  const defs = [
    {
      name: "Пълен надзор",
      description: "12 месеца грижа, чек-листът следва сезона",
      per_month: 2,
      price: 60,
      list_price: null,
      sort: 1,
    },
    {
      name: "Зимен сезон",
      description: "Октомври – април: защита от влага, студ и спукани тръби",
      per_month: 2,
      price: 40,
      list_price: null,
      sort: 2,
      active_from: "10-01",
      active_to: "04-30",
    },
    {
      name: "Летен сезон",
      description: "Май – септември: проверки след бури и жега, двор и тераса",
      per_month: 2,
      price: 50,
      list_price: null,
      sort: 3,
      active_from: "05-01",
      active_to: "09-30",
    },
  ];

  for (const d of defs) {
    const [pkg] = db.insert(packages).values({ org_id: orgId, ...d }).returning().all();
    db.insert(packageItems).values({ package_id: pkg.id, template_id: inspection, per_month: d.per_month, optional: false, sort: 1 }).run();
    db.insert(packageItems)
      .values({ package_id: pkg.id, template_id: cleaning, per_month: 1, optional: true, extra_price: 35, sort: 2 })
      .run();
  }
}
