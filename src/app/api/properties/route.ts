import { db } from "@/db";
import { properties, jobs, findings, organizations, users } from "@/db/schema";
import { eq, and, lt } from "drizzle-orm";
import { withAuth, canViewProperty } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const GET = withAuth({}, async (_request, { session }) => {
  try {
    // Изтегляме всички неархивирани имоти, после филтрираме през canViewProperty
    // (admin/inspector виждат всичко, client — само своите).
    const all = db.select().from(properties)
      .where(eq(properties.archived, false))
      .all();
    const result = all.filter((p) => canViewProperty(session, p));

    // Статусът на имота се смята с 3 групови заявки (вместо до 3 на имот в цикъл).
    // Приоритет: in_progress > warning > overdue > ok.
    const now = new Date().toISOString();

    const activeJobs = db
      .select({ property_id: jobs.property_id })
      .from(jobs)
      .where(eq(jobs.status, "in_progress"))
      .all();
    const activeSet = new Set(activeJobs.map((j) => j.property_id));

    const openFindings = db
      .select({ property_id: findings.property_id })
      .from(findings)
      .where(eq(findings.status, "open"))
      .all();
    const warningSet = new Set(openFindings.map((f) => f.property_id));

    const overdueJobs = db
      .select({ property_id: jobs.property_id })
      .from(jobs)
      .where(and(eq(jobs.status, "planned"), lt(jobs.planned_at, now)))
      .all();
    const overdueSet = new Set(overdueJobs.map((j) => j.property_id));

    const withStatus = result.map((p) => ({
      ...p,
      status: activeSet.has(p.id)
        ? "in_progress"
        : warningSet.has(p.id)
          ? "warning"
          : overdueSet.has(p.id)
            ? "overdue"
            : "ok",
    }));

    return NextResponse.json(withStatus);
  } catch (error) {
    console.error("GET /api/properties error:", error);
    return NextResponse.json({ error: "Грешка при зареждане" }, { status: 500 });
  }
});

export const POST = withAuth({}, async (request, { session }) => {
  try {
    const body = await request.json();
    let { name, city, address, lat, lng, kind } = body;

    if (!name || !city || !address) {
      return NextResponse.json(
        { error: "Име, град и адрес са задължителни" },
        { status: 400 },
      );
    }

    const fullAddress = `${city}, ${address}`;

    // Auto-geocode if lat/lng not provided but address is
    if ((lat === undefined || lng === undefined) && fullAddress) {
      try {
        const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1&accept-language=bg`;
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
        city: city || null,
        address,
        lat,
        lng,
        kind: kind || "apartment",
        owner_id: session.uid,
        org_id: session.org_id,
      })
      .returning();

    return NextResponse.json(property);
  } catch (error) {
    console.error("POST /api/properties error:", error);
    return NextResponse.json({ error: "Грешка при създаване" }, { status: 500 });
  }
});
