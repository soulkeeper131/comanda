import { db } from "@/db";
import { properties, jobs, findings, organizations, users } from "@/db/schema";
import { eq, and, lt } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = db.select().from(properties).where(eq(properties.archived, false)).all();

    // Compute real status for each property
    const now = new Date().toISOString();
    const withStatus = result.map((p) => {
      let status: string = "ok";

      // Check for active (in_progress) job
      const activeJob = db
        .select()
        .from(jobs)
        .where(
          and(
            eq(jobs.property_id, p.id),
            eq(jobs.status, "in_progress")
          )
        )
        .get();

      if (activeJob) {
        status = "in_progress";
      } else {
        // Check for open findings
        const openFinding = db
          .select()
          .from(findings)
          .where(
            and(
              eq(findings.property_id, p.id),
              eq(findings.status, "open")
            )
          )
          .get();

        if (openFinding) {
          status = "warning";
        } else {
          // Check for overdue planned jobs
          const overdueJob = db
            .select()
            .from(jobs)
            .where(
              and(
                eq(jobs.property_id, p.id),
                eq(jobs.status, "planned"),
                lt(jobs.planned_at, now)
              )
            )
            .get();

          if (overdueJob) {
            status = "overdue";
          }
        }
      }

      return { ...p, status };
    });

    return NextResponse.json(withStatus);
  } catch (error) {
    console.error("GET /api/properties error:", error);
    return NextResponse.json({ error: "Грешка при зареждане" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Не сте влезли в профила си" }, { status: 401 });
    }

    const body = await request.json();
    let { name, address, lat, lng, kind } = body;

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
        owner_id: session.uid,
        org_id: "org1", // default org
      })
      .returning();

    return NextResponse.json(property);
  } catch (error) {
    console.error("POST /api/properties error:", error);
    return NextResponse.json({ error: "Грешка при създаване" }, { status: 500 });
  }
}
