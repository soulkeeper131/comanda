import { db } from "@/db";
import { serviceTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { parseTemplatePatch } from "@/lib/domain/templates";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/templates/[id] — данните на услугата: име, описание, цена при
 * еднократна заявка, продължителност, вид, дали клиентът може да я заяви и
 * дали е скрита. Услуга не се трие — по нея има история (обходи, заявки).
 */
export const PATCH = withAuth({ role: ["admin"] }, async (request, { params }) => {
  try {
    const template = db.select().from(serviceTemplates).where(eq(serviceTemplates.id, params.id)).get();
    if (!template) return NextResponse.json({ error: "Услугата не е намерена" }, { status: 404 });

    const parsed = parseTemplatePatch(await request.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    if (Object.keys(parsed.value).length === 0) return NextResponse.json({ error: "Няма промени" }, { status: 400 });

    const [updated] = db.update(serviceTemplates).set(parsed.value).where(eq(serviceTemplates.id, template.id)).returning().all();
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/templates/[id] error:", error);
    return NextResponse.json({ error: "Грешка при запис на услугата" }, { status: 500 });
  }
});
