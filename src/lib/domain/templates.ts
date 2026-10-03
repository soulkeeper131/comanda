/** Видовете услуги — от тях зависи иконата в приложението. */
export const TEMPLATE_CATEGORIES = {
  inspection: "Обход",
  cleaning: "Почистване",
  repair: "Ремонт и майстори",
  conservation: "Консервация",
  garden: "Двор и градина",
  custom: "Друго",
} as const;
export type TemplateCategory = keyof typeof TEMPLATE_CATEGORIES;

export const PROOF_TYPES = { photo: "Снимка", note: "Бележка", none: "Без доказателство" } as const;
export type ProofType = keyof typeof PROOF_TYPES;

export const STEP_SEASONS = { all: "Винаги", winter: "Само зимата (окт–апр)", summer: "Само лятото (май–сеп)" } as const;
export type StepSeasonKey = keyof typeof STEP_SEASONS;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Сума от формуляр — приема и „12,50". */
export function parseAmount(v: unknown): number {
  if (typeof v === "number") return v;
  return Number(str(v).replace(/\s/g, "").replace(",", "."));
}

export type TemplatePatch = Partial<{
  name: string;
  description: string | null;
  price: number;
  duration_min: number;
  category: TemplateCategory;
  bookable: boolean;
  archived: boolean;
}>;

/** Промяна по услуга от админа — само познатите полета, с проверка. */
export function parseTemplatePatch(body: unknown): Result<TemplatePatch> {
  if (!body || typeof body !== "object") return { ok: false, error: "Невалидни данни" };
  const b = body as Record<string, unknown>;
  const out: TemplatePatch = {};
  if (b.name !== undefined) {
    const name = str(b.name);
    if (!name || name.length > 120) return { ok: false, error: "Името е задължително (до 120 знака)" };
    out.name = name;
  }
  if (b.description !== undefined) {
    const d = str(b.description);
    if (d.length > 500) return { ok: false, error: "Описанието е до 500 знака" };
    out.description = d || null;
  }
  if (b.price !== undefined) {
    const price = parseAmount(b.price);
    if (!Number.isFinite(price) || price < 0 || price > 100_000) return { ok: false, error: "Невалидна цена" };
    out.price = Math.round(price * 100) / 100;
  }
  if (b.duration_min !== undefined) {
    const d = Number(b.duration_min);
    if (!Number.isInteger(d) || d < 10 || d > 600) return { ok: false, error: "Продължителността е от 10 до 600 минути" };
    out.duration_min = d;
  }
  if (b.category !== undefined) {
    if (typeof b.category !== "string" || !(b.category in TEMPLATE_CATEGORIES)) return { ok: false, error: "Непознат вид услуга" };
    out.category = b.category as TemplateCategory;
  }
  if (b.bookable !== undefined) out.bookable = Boolean(b.bookable);
  if (b.archived !== undefined) out.archived = Boolean(b.archived);
  return { ok: true, value: out };
}

export type StepInput = Partial<{
  zone_label: string | null;
  label: string;
  proof_type: ProofType;
  required: boolean;
  season: StepSeasonKey;
  sort: number;
}>;

/** Точка от чек-листа — при създаване `label` е задължително. */
export function parseStepInput(body: unknown, opts: { create: boolean }): Result<StepInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "Невалидни данни" };
  const b = body as Record<string, unknown>;
  const out: StepInput = {};
  if (b.label !== undefined || opts.create) {
    const label = str(b.label);
    if (!label || label.length > 200) return { ok: false, error: "Опишете точката (до 200 знака)" };
    out.label = label;
  }
  if (b.zone_label !== undefined) {
    const zone = str(b.zone_label);
    if (zone.length > 60) return { ok: false, error: "Зоната е до 60 знака" };
    out.zone_label = zone || null;
  }
  if (b.proof_type !== undefined) {
    if (typeof b.proof_type !== "string" || !(b.proof_type in PROOF_TYPES)) return { ok: false, error: "Непознат вид доказателство" };
    out.proof_type = b.proof_type as ProofType;
  }
  if (b.season !== undefined) {
    if (typeof b.season !== "string" || !(b.season in STEP_SEASONS)) return { ok: false, error: "Сезонът е винаги, зима или лято" };
    out.season = b.season as StepSeasonKey;
  }
  if (b.required !== undefined) out.required = Boolean(b.required);
  if (b.sort !== undefined) {
    const sort = Number(b.sort);
    if (!Number.isInteger(sort) || sort < 0 || sort > 10_000) return { ok: false, error: "Невалиден ред" };
    out.sort = sort;
  }
  return { ok: true, value: out };
}
