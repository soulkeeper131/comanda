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
    let { name, address, lat, lng, kind, owner_id } = body;

    if (!name || !address) {
      return NextResponse.json(
        { error: "Име и адрес са задължителни" },
        { status: 400 },
      );
    }

    // Auto-geocode if lat/lng not provided but address is
    if ((lat === undefined || lng === undefined) && address) {
      try {
        const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&accept-language=bg`;
        const geoRes = await fetch(geocodeUrl, {
          headers: { "User-Agent": "KoManda/1.0" },
        });

        if (!geoRes.ok) {
          return NextResponse.json(
            { error: "Грешка при геокодиране на адреса" },
            { status: 400 },
          );
        }

        const geoData = await geoRes.json();

        if (!Array.isArray(geoData) || geoData.length === 0) {
          return NextResponse.json(
            { error: "Адресът не е намерен. Моля, въведете координати ръчно." },
            { status: 400 },
          );
        }

        lat = parseFloat(geoData[0].lat);
        lng = parseFloat(geoData[0].lon);
      } catch {
        return NextResponse.json(
          { error: "Грешка при геокодиране на адреса" },
          { status: 400 },
        );
      }
    }

    if (!lat || !lng) {
      return NextResponse.json(
        { error: "Координатите са задължителни" },
        { status: 400 },
      );
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
