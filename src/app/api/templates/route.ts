import { db } from "@/db";
import { serviceTemplates, templateItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { parseTemplatePatch } from "@/lib/domain/templates";

export const dynamic = "force-dynamic";

/**
 * Каталогът е видим за всеки влязъл — клиентът трябва да види какво може да
 * поръча. Преди тук стоеше role: ["admin"], което връщаше 403 на клиента и
 * правеше заявката за пакет невъзможна.
 *
 * Клиентът вижда само това, което реално се продава: неархивирани и bookable
 * услуги. Админ и инспектор виждат целия списък, включително архивния.
 * Създаването и промяната остават само за админ (виж POST по-долу).
 */
export const GET = withAuth({}, async (_request, { session }) => {
  try {
    const catalogOnly = session.role === "client";

    const rows = db
      .select()
      .from(serviceTemplates)
      .leftJoin(templateItems, eq(serviceTemplates.id, templateItems.template_id))
      .orderBy(serviceTemplates.created_at)
      .all();

    // Group items by template
    const templateMap = new Map<string, any>();
    for (const row of rows) {
      const t = row.service_templates;
      const item = row.template_items;

      if (catalogOnly && (t.archived || !t.bookable)) continue;

      if (!templateMap.has(t.id)) {
        templateMap.set(t.id, { ...t, items: [] });
      }
      if (item && item.id) {
        templateMap.get(t.id).items.push(item);
      }
    }

    const list = Array.from(templateMap.values());
    for (const t of list) t.items.sort((a: { sort: number | null }, b: { sort: number | null }) => (a.sort ?? 0) - (b.sort ?? 0));
    return NextResponse.json(list);
  } catch (error) {
    console.error("GET /api/templates error:", error);
    return NextResponse.json({ error: "Грешка при зареждане на шаблони" }, { status: 500 });
  }
});

export const POST = withAuth({ role: ["admin"] }, async (request, { session }) => {
  try {
    const body = await request.json().catch(() => null);
    const parsed = parseTemplatePatch(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { name, category } = parsed.value;
    if (!category || !name) {
      return NextResponse.json({ error: "Вид и име са задължителни" }, { status: 400 });
    }

    // Нова услуга не се вижда от клиентите, докато админът не ѝ даде цена и
    // чек-лист и не я пусне („Клиентът може да я заяви").
    const [template] = db
      .insert(serviceTemplates)
      .values({
        org_id: session.org_id,
        category,
        name,
        description: parsed.value.description ?? null,
        icon: category,
        duration_min: parsed.value.duration_min ?? 60,
        price: parsed.value.price ?? 0,
        bookable: parsed.value.bookable ?? false,
      })
      .returning()
      .all();

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("POST /api/templates error:", error);
    return NextResponse.json({ error: "Грешка при създаване на шаблон" }, { status: 500 });
  }
});
