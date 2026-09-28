import { db } from "@/db";
import { packages, packageItems, serviceTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAuth, isAdmin } from "@/lib/auth";
import { loadCatalog } from "@/lib/catalog";
import { parsePackageInput } from "@/lib/domain/packages";

export const dynamic = "force-dynamic";

/**
 * GET /api/packages — каталогът (N5). Клиентът вижда неархивираните,
 * админът — всички (?all=1).
 */
export const GET = withAuth({}, async (request, { session }) => {
  try {
    const all = isAdmin(session) && new URL(request.url).searchParams.get("all") === "1";
    return NextResponse.json(loadCatalog({ includeArchived: all }));
  } catch (error) {
    console.error("GET /api/packages error:", error);
    return NextResponse.json({ error: "Грешка при зареждане на пакетите" }, { status: 500 });
  }
});

/** POST /api/packages — нов пакет (само админ). */
export const POST = withAuth({ role: ["admin"] }, async (request, { session }) => {
  try {
    const parsed = parsePackageInput(await request.json());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { items, ...fields } = parsed.value;

    for (const item of items) {
      const tpl = db.select({ id: serviceTemplates.id }).from(serviceTemplates).where(eq(serviceTemplates.id, item.template_id)).get();
      if (!tpl) return NextResponse.json({ error: "Непозната услуга в пакета" }, { status: 400 });
    }

    const pkg = db.transaction((tx) => {
      const [created] = tx.insert(packages).values({ ...fields, org_id: session.org_id }).returning().all();
      items.forEach((item, i) => {
        tx.insert(packageItems).values({ ...item, package_id: created.id, sort: i + 1 }).run();
      });
      return created;
    });
    return NextResponse.json(pkg, { status: 201 });
  } catch (error) {
    console.error("POST /api/packages error:", error);
    return NextResponse.json({ error: "Грешка при създаване на пакет" }, { status: 500 });
  }
});
