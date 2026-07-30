import { db } from "@/db";
import { templateItems } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { template_id, zone_label, label, proof_type, required, sort } = body;

    if (!template_id || !label) {
      return NextResponse.json(
        { error: "template_id и label са задължителни" },
        { status: 400 }
      );
    }

    db
      .insert(templateItems)
      .values({
        template_id,
        zone_label: zone_label || null,
        label,
        proof_type: proof_type || "photo",
        required: required !== undefined ? required : true,
        sort: sort ?? 0,
      })
      .run();

    // SQLite doesn't support RETURNING — fetch the last inserted item by querying all for this template
    const items = db
      .select()
      .from(templateItems)
      .where(eq(templateItems.template_id, template_id))
      .orderBy(asc(templateItems.sort))
      .all();

    const created = items[items.length - 1];

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/template-items error:", error);
    return NextResponse.json(
      { error: "Грешка при създаване на елемент от шаблон" },
      { status: 500 }
    );
  }
}
