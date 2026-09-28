export type PackageItemInput = {
  template_id: string;
  per_month: number;
  optional: boolean;
  extra_price: number;
};

export type PackageInput = {
  name: string;
  description: string | null;
  per_month: number;
  price: number;
  list_price: number | null;
  active_from: string | null;
  active_to: string | null;
  items: PackageItemInput[];
};

export const FREQUENCIES = [1, 2, 4] as const;

const MMDD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

type Result = { ok: true; value: PackageInput } | { ok: false; error: string };

/** Валидира пакет от админския формуляр. Точно едно ядро (обходът). */
export function parsePackageInput(body: unknown): Result {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { ok: false, error: "Името е задължително" };

  const perMonth = Number(b.per_month);
  if (!(FREQUENCIES as readonly number[]).includes(perMonth)) {
    return { ok: false, error: "Честотата е 1, 2 или 4 обхода месечно" };
  }
  const price = Number(b.price);
  if (!Number.isFinite(price) || price <= 0) return { ok: false, error: "Невалидна цена" };
  const listPrice = b.list_price === undefined || b.list_price === null || b.list_price === "" ? null : Number(b.list_price);
  if (listPrice !== null && (!Number.isFinite(listPrice) || listPrice < price)) {
    return { ok: false, error: "Цената без отстъпка трябва да е поне колкото цената" };
  }

  const from = typeof b.active_from === "string" && b.active_from ? b.active_from : null;
  const to = typeof b.active_to === "string" && b.active_to ? b.active_to : null;
  if ((from && !MMDD.test(from)) || (to && !MMDD.test(to)) || Boolean(from) !== Boolean(to)) {
    return { ok: false, error: "Сезонът е две дати във формат ММ-ДД, или нито една" };
  }

  const rawItems = Array.isArray(b.items) ? b.items : [];
  const items: PackageItemInput[] = [];
  for (const raw of rawItems) {
    const r = (raw ?? {}) as Record<string, unknown>;
    if (typeof r.template_id !== "string" || !r.template_id) return { ok: false, error: "Услуга без шаблон" };
    const optional = Boolean(r.optional);
    const itemPerMonth = optional ? Number(r.per_month ?? 1) : perMonth;
    if (!(FREQUENCIES as readonly number[]).includes(itemPerMonth)) {
      return { ok: false, error: "Честотата на опцията е 1, 2 или 4 месечно" };
    }
    const extra = optional ? Number(r.extra_price ?? 0) : 0;
    if (!Number.isFinite(extra) || extra < 0) return { ok: false, error: "Невалидна добавка към цената" };
    items.push({ template_id: r.template_id, per_month: itemPerMonth, optional, extra_price: extra });
  }
  if (items.filter((i) => !i.optional).length !== 1) {
    return { ok: false, error: "Пакетът има точно една основна услуга (обходът)" };
  }

  return {
    ok: true,
    value: {
      name,
      description: typeof b.description === "string" && b.description.trim() ? b.description.trim() : null,
      per_month: perMonth,
      price,
      list_price: listPrice,
      active_from: from,
      active_to: to,
      items,
    },
  };
}
