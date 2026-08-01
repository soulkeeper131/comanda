import { db } from "@/db";
import { offers, findings, properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/offers — всички оферти (с JOIN към findings и properties)
// GET /api/offers?finding_id=X — филтрира по finding
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const findingId = searchParams.get("finding_id");

    let query = db.select().from(offers);

    if (findingId) {
      query = query.where(eq(offers.finding_id, findingId));
    }

    const offersList = await query;

    // Enrich with finding + property data
    const enriched = await Promise.all(
      offersList.map(async (offer) => {
        const [finding] = await db
          .select()
          .from(findings)
          .where(eq(findings.id, offer.finding_id));

        let propertyName = "";
        let propertyId = "";
        if (finding) {
          propertyId = finding.property_id;
          const [property] = await db
            .select()
            .from(properties)
            .where(eq(properties.id, finding.property_id));
          propertyName = property?.name || "";
        }

        return {
          id: offer.id,
          finding_id: offer.finding_id,
          price: offer.price,
          days: offer.days,
          scope: offer.scope,
          sent_at: offer.sent_at,
          decision: offer.decision,
          finding: finding
            ? {
                id: finding.id,
                title: finding.title,
                body: finding.body,
                status: finding.status,
                type: finding.status === "open" ? "Друго" : finding.status,
                property_id: finding.property_id || propertyId,
                property_name: propertyName,
                created_at: finding.created_at,
              }
            : null,
        };
      })
    );

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("GET /api/offers error:", error);
    return NextResponse.json(
      { error: "Грешка при зареждане на оферти" },
      { status: 500 }
    );
  }
}

// POST /api/offers — създава нова оферта
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { finding_id, price, days, scope } = body;

    if (!finding_id) {
      return NextResponse.json(
        { error: "finding_id е задължително" },
        { status: 400 }
      );
    }

    if (!price || !days || !scope?.trim()) {
      return NextResponse.json(
        { error: "Цена, срок и обхват са задължителни" },
        { status: 400 }
      );
    }

    const [offer] = await db
      .insert(offers)
      .values({
        finding_id,
        price: parseFloat(price),
        days: parseInt(days, 10),
        scope: scope.trim(),
        decision: "pending",
      })
      .returning();

    return NextResponse.json(offer, { status: 201 });
  } catch (error) {
    console.error("POST /api/offers error:", error);
    return NextResponse.json(
      { error: "Грешка при създаване на оферта" },
      { status: 500 }
    );
  }
}
