import { db } from "@/db";
import { zones, properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { withAuth, canViewProperty } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const GET = withAuth({}, async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("property_id");

    if (!propertyId) {
      return NextResponse.json({ error: "property_id е задължително" }, { status: 400 });
    }

    // Зоната принадлежи на имот — правата се проверяват през родителя.
    const property = db.select().from(properties).where(eq(properties.id, propertyId)).get();
    if (!property) {
      return NextResponse.json({ error: "Имотът не е намерен" }, { status: 404 });
    }
    if (!canViewProperty(session, property)) {
      return NextResponse.json({ error: "Имотът не е намерен" }, { status: 404 });
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
});
