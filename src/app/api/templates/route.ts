import { db } from "@/db";
import { serviceTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const templates = db.select().from(serviceTemplates).all();
    return NextResponse.json(templates);
  } catch (error) {
    console.error("GET /api/templates error:", error);
    return NextResponse.json({ error: "Грешка при зареждане на шаблони" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { category, name, description, icon, duration_min, price } = body;

    if (!category || !name) {
      return NextResponse.json(
        { error: "Категория и име са задължителни" },
        { status: 400 }
      );
    }

    const [template] = db
      .insert(serviceTemplates)
      .values({
        org_id: "org1",
        category,
        name,
        description: description || null,
        icon: icon || "🧹",
        duration_min: duration_min ?? 60,
        price: price ?? 0,
      })
      .returning();

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("POST /api/templates error:", error);
    return NextResponse.json({ error: "Грешка при създаване на шаблон" }, { status: 500 });
  }
}
