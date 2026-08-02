import { db } from "@/db";
import { zones } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("property_id");

    if (!propertyId) {
      return NextResponse.json({ error: "property_id е задължително" }, { status: 400 });
    }

    const rows = db
      .select()
      .from(zones)
      .where(eq(zones.property_id, propertyId))
      .orderBy(zones.sort)
      .all();

    return NextResponse.json(rows);
  } catch (error) {
    console.error("GET /api/zones error:", error);
    return NextResponse.json({ error: "Грешка при зареждане на зони" }, { status: 500 });
  }
}
