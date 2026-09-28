import { db } from "@/db";
import { plans, properties, packages } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { withAuth, canViewProperty } from "@/lib/auth";
import { NextResponse } from "next/server";
import { loadCatalog, coreItem, planPrice } from "@/lib/catalog";
import { notifyAdmins } from "@/lib/notifications";
import { sendEmail, getNotifyEmail } from "@/lib/email";
import { emailLayout, formatEur } from "@/lib/mail-layout";
import { isLivePlan } from "@/lib/domain/plans";

export const dynamic = "force-dynamic";

// GET /api/properties/[id]/plans — абонаментите на имота (най-новият първи)
export const GET = withAuth({}, async (_request, { session, params }) => {
  try {
    const prop = db.select().from(properties).where(eq(properties.id, params.id)).get();
    if (!prop || !canViewProperty(session, prop)) {
      return NextResponse.json({ error: "Имотът не е намерен" }, { status: 404 });
    }
    const result = db
      .select({ plan: plans, package_name: packages.name })
      .from(plans)
      .leftJoin(packages, eq(plans.package_id, packages.id))
      .where(eq(plans.property_id, params.id))
      .orderBy(desc(plans.started_at))
      .all()
      .map((r) => ({ ...r.plan, package_name: r.package_name }));
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET plans error:", error);
    return NextResponse.json({ error: "Грешка" }, { status: 500 });
  }
});

/**
 * POST /api/properties/[id]/plans — заявка за абонамент (N6).
 * Body: { package_id, options?: string[] }
 *
 * - само собственикът (или админ от негово име)
 * - само за одобрен имот — иначе одобрението е формалност (въпрос 24)
 * - един жив абонамент на имот (въпрос 6)
 * - цената идва от пакета, не от тялото на заявката
 * - планът е "requested" — генерира чак когато админът насрочи първия обход
 */
export const POST = withAuth({ role: ["admin", "client"] }, async (request, { session, params }) => {
  try {
    const prop = db.select().from(properties).where(eq(properties.id, params.id)).get();
    if (!prop || !canViewProperty(session, prop)) {
      return NextResponse.json({ error: "Имотът не е намерен" }, { status: 404 });
    }
    if (prop.status !== "active" || prop.archived) {
      return NextResponse.json(
        { error: "Пакет се избира след като имотът бъде одобрен" },
        { status: 409 },
      );
    }

    const existing = db
      .select()
      .from(plans)
      .where(eq(plans.property_id, prop.id))
      .all()
      .find((p) => isLivePlan(p));
    if (existing) {
      return NextResponse.json({ error: "Имотът вече има абонамент" }, { status: 409 });
    }

    const body = await request.json().catch(() => ({}));
    const pkg = loadCatalog().find((p) => p.id === body.package_id);
    if (!pkg) {
      return NextResponse.json({ error: "Изберете пакет от каталога" }, { status: 400 });
    }
    if (!pkg.in_season) {
      return NextResponse.json({ error: "Този сезонен пакет в момента не се предлага" }, { status: 409 });
    }
    const core = coreItem(pkg);
    if (!core) {
      return NextResponse.json({ error: "Пакетът няма основна услуга" }, { status: 500 });
    }
    const optionIds: string[] = Array.isArray(body.options)
      ? body.options.filter((id: unknown) => pkg.items.some((i) => i.optional && i.id === id))
      : [];

    const price = planPrice(pkg, optionIds);
    const [plan] = db
      .insert(plans)
      .values({
        property_id: prop.id,
        template_id: core.template_id,
        package_id: pkg.id,
        name: pkg.name,
        per_month: pkg.per_month,
        price,
        options: JSON.stringify(optionIds),
        status: "requested",
        active: true,
      })
      .returning()
      .all();

    notifyAdmins("plan_requested", "Нов абонамент чака насрочване", `${prop.name} — ${pkg.name}`, "/dashboard");
    sendEmail({
      to: (await getNotifyEmail()) || "",
      subject: `Нов абонамент: ${prop.name} — ${pkg.name}`,
      html: emailLayout({
        title: "Нов абонамент чака насрочване",
        intro: "Обадете се на клиента и насрочете първия обход.",
        rows: [
          ["Имот", prop.name],
          ["Адрес", prop.address],
          ["Пакет", pkg.name],
          ["Опции", pkg.items.filter((i) => optionIds.includes(i.id)).map((i) => i.template_name).join(", ")],
          ["Месечно", formatEur(price)],
          ["Контакт", [prop.contact_name, prop.contact_phone].filter(Boolean).join(", ")],
        ],
        cta: { label: "Насрочи" },
      }),
    }).catch(() => {});

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    console.error("POST plan error:", error);
    return NextResponse.json({ error: "Грешка при заявката за пакет" }, { status: 500 });
  }
});
