import { db } from "@/db";
import { plans, properties, packages, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET /api/plans — всички абонаменти за админа (опашка „чака насрочване"). */
export const GET = withAuth({ role: ["admin"] }, async () => {
  try {
    const rows = db
      .select({
        plan: plans,
        property_name: properties.name,
        property_address: properties.address,
        property_status: properties.status,
        contact_name: properties.contact_name,
        contact_phone: properties.contact_phone,
        assigned_inspector_id: properties.assigned_inspector_id,
        owner_name: users.full_name,
        owner_email: users.email,
        owner_phone: users.phone,
        package_name: packages.name,
      })
      .from(plans)
      .innerJoin(properties, eq(plans.property_id, properties.id))
      .innerJoin(users, eq(properties.owner_id, users.id))
      .leftJoin(packages, eq(plans.package_id, packages.id))
      .orderBy(desc(plans.started_at))
      .all();
    return NextResponse.json(rows.map(({ plan, ...rest }) => ({ ...plan, ...rest })));
  } catch (error) {
    console.error("GET /api/plans error:", error);
    return NextResponse.json({ error: "Грешка при зареждане на абонаментите" }, { status: 500 });
  }
});
