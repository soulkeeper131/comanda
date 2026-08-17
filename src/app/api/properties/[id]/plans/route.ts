import { db } from "@/db";
import { plans, properties, serviceTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { withAuth, canViewProperty } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/properties/[id]/plans — list plans for a property
export const GET = withAuth({}, async (_request, { session, params }) => {
  try {
    const prop = db.select().from(properties)
      .where(eq(properties.id, params.id))
      .get();

    if (!prop) {
      return NextResponse.json({ error: "Имотът не е намерен" }, { status: 404 });
    }
    if (!canViewProperty(session, prop)) {
      return NextResponse.json({ error: "Нямате достъп до този имот" }, { status: 404 });
    }

    const result = db.select().from(plans)
      .where(eq(plans.property_id, params.id))
      .all();

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET plans error:", error);
    return NextResponse.json({ error: "Грешка" }, { status: 500 });
  }
});

// POST /api/properties/[id]/plans — add a plan to a property
export const POST = withAuth({}, async (request, { session, params }) => {
  try {
    const prop = db.select().from(properties)
      .where(eq(properties.id, params.id))
      .get();

    if (!prop) {
      return NextResponse.json({ error: "Имотът не е намерен" }, { status: 404 });
    }
    if (!canViewProperty(session, prop)) {
      return NextResponse.json({ error: "Нямате достъп до този имот" }, { status: 404 });
    }

    const body = await request.json();
    const { plan_type } = body; // "year" | "winter" | "summer"

    const PLAN_DEFS: Record<string, { name: string; price: number; template_name: string }> = {
      year: { name: "Пълен надзор", price: 60, template_name: "Пълен надзор" },
      winter: { name: "Зимен сезон", price: 40, template_name: "Зимен обход" },
      summer: { name: "Летен сезон", price: 50, template_name: "Летен обход" },
    };

    const def = PLAN_DEFS[plan_type];
    if (!def) {
      return NextResponse.json({ error: "Невалиден тип пакет" }, { status: 400 });
    }

    // Find matching template
    const template = db.select().from(serviceTemplates)
      .where(eq(serviceTemplates.name, def.template_name))
      .get();

    if (!template) {
      return NextResponse.json({ error: "Шаблонът не е намерен" }, { status: 400 });
    }

    const [plan] = await db.insert(plans).values({
      property_id: params.id,
      template_id: template.id,
      name: def.name,
      price: def.price,
      per_month: 2,
      active: true,
    }).returning();

    return NextResponse.json(plan);
  } catch (error) {
    console.error("POST plan error:", error);
    return NextResponse.json({ error: "Грешка при добавяне на пакет" }, { status: 500 });
  }
});
