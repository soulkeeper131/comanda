import { db } from "@/db";
import { serviceTemplates, templateItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";

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

    return NextResponse.json(Array.from(templateMap.values()));
  } catch (error) {
    console.error("GET /api/templates error:", error);
    return NextResponse.json({ error: "Грешка при зареждане на шаблони" }, { status: 500 });
  }
});

export const POST = withAuth({ role: ["admin"] }, async (request, { session }) => {
  try {
    const body = await request.json();
    const { category, name, description, icon, duration_min, price } = body;

    if (!category || !name) {
      return NextResponse.json(
        { error: "Категория и име са задължителни" },
        { status: 400 }
      );
    }

    db
      .insert(serviceTemplates)
      .values({
        org_id: session.org_id,
        category,
        name,
        description: description || null,
        icon: icon || "🧹",
        duration_min: duration_min ?? 60,
        price: price ?? 0,
      })
      .run();

    // SQLite doesn't support RETURNING — fetch by name
    const [template] = db.select().from(serviceTemplates).where(eq(serviceTemplates.name, name)).limit(1).all();

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("POST /api/templates error:", error);
    return NextResponse.json({ error: "Грешка при създаване на шаблон" }, { status: 500 });
  }
});
