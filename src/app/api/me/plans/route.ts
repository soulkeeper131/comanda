import { db } from "@/db";
import { plans, properties } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Не сте влезли" }, { status: 401 });
    }

    // Get all properties owned by this user
    const userProperties = db.select({ id: properties.id, name: properties.name })
      .from(properties)
      .where(eq(properties.owner_id, session.uid))
      .all();

    // Get plans for all user properties
    const allPlans: any[] = [];
    for (const prop of userProperties) {
      const propPlans = db.select().from(plans)
        .where(eq(plans.property_id, prop.id))
        .all();
      for (const plan of propPlans) {
        allPlans.push({ ...plan, property_name: prop.name });
      }
    }

    return NextResponse.json(allPlans);
  } catch (error) {
    console.error("GET /api/me/plans error:", error);
    return NextResponse.json({ error: "Грешка" }, { status: 500 });
  }
}
