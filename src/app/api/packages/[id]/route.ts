import { db } from "@/db";
import { packages, packageItems, serviceTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { parsePackageInput } from "@/lib/domain/packages";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/packages/[id] — промяна на пакет (само админ).
 * Вече заявените абонаменти пазят своята цена и честота — промяната важи
 * за новите заявки. `archived: true` го маха от каталога.
 */
export const PATCH = withAuth({ role: ["admin"] }, async (request, { params }) => {
  try {
    const existing = db.select().from(packages).where(eq(packages.id, params.id)).get();
    if (!existing) return NextResponse.json({ error: "Пакетът не е намерен" }, { status: 404 });

    const body = await request.json();
    if (Object.keys(body).length === 1 && typeof body.archived === "boolean") {
      const [updated] = db.update(packages).set({ archived: body.archived }).where(eq(packages.id, params.id)).returning().all();
      return NextResponse.json(updated);
    }

    const parsed = parsePackageInput(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { items, ...fields } = parsed.value;
    for (const item of items) {
      const tpl = db.select({ id: serviceTemplates.id }).from(serviceTemplates).where(eq(serviceTemplates.id, item.template_id)).get();
      if (!tpl) return NextResponse.json({ error: "Непозната услуга в пакета" }, { status: 400 });
    }

    const updated = db.transaction((tx) => {
      const [row] = tx.update(packages).set(fields).where(eq(packages.id, params.id)).returning().all();
      // Редовете се заменят само ако са подадени — иначе id-тата на опциите,
      // запазени в plans.options, ще сочат към несъществуващи редове.
      if (Array.isArray(body.items)) {
        const old = tx.select().from(packageItems).where(eq(packageItems.package_id, params.id)).all();
        const keep = new Set<string>();
        items.forEach((item, i) => {
          const match = old.find((o) => o.template_id === item.template_id && Boolean(o.optional) === item.optional);
          if (match) {
            keep.add(match.id);
            tx.update(packageItems).set({ ...item, sort: i + 1 }).where(eq(packageItems.id, match.id)).run();
          } else {
            tx.insert(packageItems).values({ ...item, package_id: params.id, sort: i + 1 }).run();
          }
        });
        for (const o of old) if (!keep.has(o.id)) tx.delete(packageItems).where(eq(packageItems.id, o.id)).run();
      }
      return row;
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/packages/[id] error:", error);
    return NextResponse.json({ error: "Грешка при промяна на пакет" }, { status: 500 });
  }
});
