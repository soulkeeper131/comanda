import { db } from "@/db";
import { serviceTemplates, templateItems } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { parseStepInput } from "@/lib/domain/templates";

export const dynamic = "force-dynamic";

export const GET = withAuth({ role: ["admin"] }, async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get("template_id");

    if (!templateId) {
      return NextResponse.json(
        { error: "Параметърът template_id е задължителен" },
        { status: 400 }
      );
    }

    const items = db
      .select()
      .from(templateItems)
      .where(eq(templateItems.template_id, templateId))
      .orderBy(asc(templateItems.sort))
      .all();

    return NextResponse.json(items);
  } catch (error) {
    console.error("GET /api/template-items error:", error);
    return NextResponse.json(
      { error: "Грешка при зареждане на елементи от шаблон" },
      { status: 500 }
    );
  }
});

/** Нова точка в чек-листа — най-отдолу, ако не е казано друго. */
export const POST = withAuth({ role: ["admin"] }, async (request) => {
  try {
    const body = await request.json().catch(() => null);
    const templateId = typeof body?.template_id === "string" ? body.template_id : "";
    const template = templateId
      ? db.select({ id: serviceTemplates.id }).from(serviceTemplates).where(eq(serviceTemplates.id, templateId)).get()
      : undefined;
    if (!template) return NextResponse.json({ error: "Услугата не е намерена" }, { status: 404 });

    const parsed = parseStepInput(body, { create: true });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const last = db
      .select({ sort: templateItems.sort })
      .from(templateItems)
      .where(eq(templateItems.template_id, template.id))
      .all()
      .reduce((max, i) => Math.max(max, i.sort ?? 0), 0);

    const [created] = db
      .insert(templateItems)
      .values({
        template_id: template.id,
        label: parsed.value.label!,
        zone_label: parsed.value.zone_label ?? null,
        proof_type: parsed.value.proof_type ?? "photo",
        required: parsed.value.required ?? true,
        season: parsed.value.season ?? "all",
        sort: parsed.value.sort ?? last + 1,
      })
      .returning()
      .all();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/template-items error:", error);
    return NextResponse.json(
      { error: "Грешка при създаване на елемент от шаблон" },
      { status: 500 }
    );
  }
});
