import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await db.select().from(properties).where(eq(properties.archived, false));
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/properties error:", error);
    return NextResponse.json({ error: "Грешка при зареждане" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, address, lat, lng, kind, owner_id } = body;

    if (!name || !address || !lat || !lng) {
      return NextResponse.json({ error: "Име, адрес и координати са задължителни" }, { status: 400 });
    }

    const [property] = await db
      .insert(properties)
      .values({
        name,
        address,
        lat,
        lng,
        kind: kind || "apartment",
        owner_id: owner_id || "u2", // default owner
        org_id: "org1", // default org
      })
      .returning();

    return NextResponse.json(property);
  } catch (error) {
    console.error("POST /api/properties error:", error);
    return NextResponse.json({ error: "Грешка при създаване" }, { status: 500 });
  }
}
