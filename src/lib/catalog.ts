import { db } from "@/db";
import { packages, packageItems, serviceTemplates, templateItems } from "@/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDefaultOrgId } from "@/lib/org";
import { addDays, inSeason } from "@/lib/domain/schedule";
import { todaySofia } from "@/lib/jobs-generator";
import { getSetting, setSetting } from "@/lib/settings";

export type StepSeason = "all" | "winter" | "summer";
export type ChecklistStep = { zone: string | null; label: string; season: StepSeason };

export type CatalogItem = {
  id: string;
  template_id: string;
  template_name: string;
  category: string;
  description: string | null;
  per_month: number;
  optional: boolean;
  extra_price: number;
  /** Точките в чек-листа, които важат в сезона на пакета. */
  steps: number;
  checklist: ChecklistStep[];
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
    ? db
        .select({ template_id: templateItems.template_id, zone: templateItems.zone_label, label: templateItems.label, season: templateItems.season })
        .from(templateItems)
        .where(inArray(templateItems.template_id, templateIds))
        .orderBy(asc(templateItems.sort))
        .all()
    : [];

  const today = todaySofia();
  return rows.map((p) => ({
    ...p,
    // Сезонен пакет се заявява и до 30 дни преди сезона — генераторът и без
    // това създава обходи само в сезона.
    in_season: inSeason(today, p.active_from, p.active_to) || inSeason(addDays(today, 30), p.active_from, p.active_to),
    items: items
      .filter((i) => i.item.package_id === p.id)
      .map(({ item, template }) => {
        const checklist = steps
          .filter((s) => s.template_id === template.id && stepInPackage(s.season, p.active_from, p.active_to))
          .map((s) => ({ zone: s.zone, label: s.label, season: (s.season ?? "all") as StepSeason }));
        return {
          id: item.id,
          template_id: template.id,
          template_name: template.name,
          category: template.category,
          description: template.description,
          per_month: item.optional ? item.per_month : p.per_month,
          optional: Boolean(item.optional),
          extra_price: item.extra_price ?? 0,
          steps: checklist.length,
          checklist,
        };
      }),
  }));
}

/**
 * Влиза ли сезонна точка в чек-листа на пакета: зимният пакет (окт–апр)
 * няма летни точки и обратно; целогодишният има всички — сменят се сами.
 */
function stepInPackage(season: string | null, from: string | null, to: string | null): boolean {
  if (!season || season === "all" || !from || !to) return true;
  // Проверяваме средата на сезона на точката — 15 януари / 15 юли.
  return inSeason(season === "winter" ? "2000-01-15" : "2000-07-15", from, to);
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

type StepDef = [zone: string, label: string, proof?: "photo" | "note" | "none", required?: boolean, season?: StepSeason];

function addSteps(templateId: string, steps: StepDef[], startSort = 1) {
  steps.forEach(([zone, label, proof = "photo", required = true, season = "all"], i) => {
    db.insert(templateItems)
      .values({ template_id: templateId, zone_label: zone, label, proof_type: proof, required, season, sort: startSort + i })
      .run();
  });
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
  addSteps(tpl.id, fallback.steps);
  return tpl.id;
}

/**
 * Началният каталог — само ако още няма нито един пакет. Цените са
 * отправна точка; админът ги сменя от панела. Замества трите зашити
 * константи, които PlanSelector показваше, без да съществуват в базата.
 */
export function ensureDefaultCatalog() {
  seedPackages();
  upgradeCatalog();
}

function seedPackages() {
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

// ============================================================
// Каталог v2: сезонен чек-лист и услугите, обещани на сайта
// ============================================================

/**
 * Точките, които обходът добавя към основния чек-лист. Целогодишните важат
 * винаги; зимните — октомври–април, летните — май–септември. Задължителни
 * са само тези, които важат за всеки имот (не всеки има двор или климатик).
 */
const SEASONAL_STEPS: StepDef[] = [
  ["Вход", "Пощенска кутия — пощата е прибрана", "photo", false, "all"],
  ["Общо", "Показания на водомер и електромер", "photo", false, "all"],
  ["Общо", "Проветряване — 10 минути, после прозорците са затворени", "none", true, "all"],
  ["Общо", "Сифони — пусната вода във всички, без миризма", "none", true, "all"],
  ["Общо", "Стени и ъгли — без влага и мухъл", "photo", true, "winter"],
  ["Общо", "Отопление — работи в режим против замръзване", "photo", false, "winter"],
  ["Баня", "Тръби в студени помещения — без лед и пукнатини", "photo", false, "winter"],
  ["Отвън", "Покрив и улуци — без натрупан сняг и лед", "photo", false, "winter"],
  ["Общо", "Вредители — без следи от гризачи, насекоми и гнезда", "none", true, "summer"],
  ["Отвън", "Тераса и балкон — отводняването е свободно", "photo", false, "summer"],
  ["Отвън", "Двор — общ изглед, растенията, поливането", "photo", false, "summer"],
  ["Общо", "Климатик — пробно пускане, без теч", "photo", false, "summer"],
];

type ServiceDef = {
  name: string;
  category: string;
  description: string;
  duration_min: number;
  price: number;
  steps: StepDef[];
};

/** Еднократните услуги от сайта — всяка се заявява и плаща от приложението. */
export const EXTRA_SERVICES: ServiceDef[] = [
  {
    name: "Проверка след буря",
    category: "inspection",
    description: "След буря, силен вятър, спрян ток или сигнал от съсед — отиваме и пращаме снимки на покрива, прозорците и двора.",
    duration_min: 45,
    price: 25,
    steps: [
      ["Отвън", "Покрив, улуци и комин — видими щети"],
      ["Отвън", "Двор и тераса — паднали клони и предмети", "photo", false],
      ["Общо", "Прозорци и врати — цели, без проникнала вода"],
      ["Общо", "Ел. табло — без изключени предпазители"],
      ["Общо", "Общ изглед на всяко помещение"],
    ],
  },
  {
    name: "Присъствие при майстор",
    category: "repair",
    description: "Водопроводчик, електротехник, техник или застрахователен оглед — пускаме го, присъстваме до 2 часа и снимаме свършеното.",
    duration_min: 120,
    price: 20,
    steps: [
      ["Вход", "Кой е дошъл и за какво", "note"],
      ["Общо", "Свършената работа — снимки преди и след"],
      ["Вход", "Имотът е заключен след излизането"],
    ],
  },
  {
    name: "Поливане и грижа за двора",
    category: "garden",
    description: "Поливане на растенията вкъщи и в двора; косене и почистване на листа по уговорка.",
    duration_min: 60,
    price: 30,
    steps: [
      ["Вкъщи", "Растенията вкъщи — полети", "photo", false],
      ["Двор", "Двор и градина — полети"],
      ["Двор", "Косене или почистване на листа — по уговорка", "photo", false],
      ["Двор", "Общ изглед на двора"],
    ],
  },
  {
    name: "Зимна консервация",
    category: "conservation",
    description: "Преди дълго отсъствие през зимата: спиране и източване на водата, режим на отоплението, уредите извън контакт.",
    duration_min: 120,
    price: 75,
    steps: [
      ["Баня", "Водата е спряна на главния кран"],
      ["Баня", "Инсталацията е източена — крановете отворени, бойлерът изключен"],
      ["Общо", "Отоплението е в режим против замръзване", "photo", false],
      ["Кухня", "Хладилник и уреди — изключени, вратите открехнати", "photo", false],
      ["Общо", "Прозорци и капаци — затворени"],
    ],
  },
  {
    name: "Приемане на доставка",
    category: "custom",
    description: "Мебел, техника или пратка с подпис — приемаме я, проверяваме за щети и снимаме опаковката преди и след отваряне.",
    duration_min: 60,
    price: 15,
    steps: [
      ["Вход", "Пратката е приета — от кого, какво", "note"],
      ["Вход", "Опаковката преди отваряне"],
      ["Вход", "Съдържанието — без видими щети"],
    ],
  },
  {
    name: "Фотоотчет за трета страна",
    category: "inspection",
    description: "Пълен снимков протокол за застраховател, банка, купувач или при спор със съсед — с дата и час на всяка снимка.",
    duration_min: 60,
    price: 20,
    steps: [
      ["Отвън", "Сградата и входът — общ изглед"],
      ["Общо", "Всяко помещение — общ изглед"],
      ["Общо", "Подробностите по заявката", "photo"],
    ],
  },
];

const CATALOG_VERSION = 2;

/**
 * Еднократно допълване на каталога (до v2): сезонните точки в чек-листа на
 * обхода и услугите от сайта. Пипа само липсващото — изтрито или променено
 * от админа след това не се връща (затова версия в settings).
 */
export function upgradeCatalog() {
  const current = Number(getSetting("catalog_version") || 1);
  if (current >= CATALOG_VERSION) return;
  let orgId: string;
  try {
    orgId = getDefaultOrgId();
  } catch {
    return; // празна база — каталогът още не е създаден
  }

  db.transaction(() => {
    // Ядрата на пакетите от вид „обход" получават сезонните точки.
    const cores = db
      .selectDistinct({ id: serviceTemplates.id })
      .from(packageItems)
      .innerJoin(serviceTemplates, eq(packageItems.template_id, serviceTemplates.id))
      .where(and(eq(packageItems.optional, false), eq(serviceTemplates.category, "inspection")))
      .all();
    for (const core of cores) {
      const existing = db.select({ label: templateItems.label, sort: templateItems.sort }).from(templateItems).where(eq(templateItems.template_id, core.id)).all();
      const labels = new Set(existing.map((e) => e.label.toLowerCase()));
      const missing = SEASONAL_STEPS.filter(([, label]) => !labels.has(label.toLowerCase()));
      const maxSort = existing.reduce((m, e) => Math.max(m, e.sort ?? 0), 0);
      addSteps(core.id, missing, maxSort + 1);
    }

    for (const def of EXTRA_SERVICES) {
      const exists = db
        .select({ id: serviceTemplates.id })
        .from(serviceTemplates)
        .where(eq(serviceTemplates.name, def.name))
        .get();
      if (exists) continue;
      const [tpl] = db
        .insert(serviceTemplates)
        .values({
          org_id: orgId,
          category: def.category,
          name: def.name,
          description: def.description,
          icon: def.category,
          duration_min: def.duration_min,
          price: def.price,
          bookable: true,
        })
        .returning()
        .all();
      addSteps(tpl.id, def.steps);
    }
    setSetting("catalog_version", String(CATALOG_VERSION));
  });
}

export type BookableService = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  duration_min: number | null;
};

/**
 * Услугите, които клиентът заявява еднократно (и сайтът показва): пуснати,
 * със цена. Първо тези от сайта, в техния ред; после останалите.
 */
export function loadBookableServices(): BookableService[] {
  ensureDefaultCatalog();
  const rows = db
    .select({
      id: serviceTemplates.id,
      name: serviceTemplates.name,
      category: serviceTemplates.category,
      description: serviceTemplates.description,
      price: serviceTemplates.price,
      duration_min: serviceTemplates.duration_min,
    })
    .from(serviceTemplates)
    .where(and(eq(serviceTemplates.archived, false), eq(serviceTemplates.bookable, true)))
    .orderBy(asc(serviceTemplates.created_at))
    .all()
    .filter((t) => Number(t.price) > 0)
    .map((t) => ({ ...t, price: Number(t.price) }));
  const rank = (name: string) => {
    const i = EXTRA_SERVICES.findIndex((d) => d.name === name);
    return i === -1 ? EXTRA_SERVICES.length : i;
  };
  return rows.sort((a, b) => rank(a.name) - rank(b.name));
}
