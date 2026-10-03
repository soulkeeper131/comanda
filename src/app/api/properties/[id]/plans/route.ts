import { db } from "@/db";
import { plans, properties, packages, payments } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { withAuth, canViewProperty } from "@/lib/auth";
import { NextResponse } from "next/server";
import { loadCatalog, coreItem, planPrice } from "@/lib/catalog";
import { isLivePlan } from "@/lib/domain/plans";
import { isStripeConfigured } from "@/lib/stripe";
import { createSubscriptionCheckout, expirePlanCheckout, requestPlanBankPayment } from "@/lib/subscriptions";
import { todaySofia } from "@/lib/jobs-generator";
import { bankRows, notify, propertyLink } from "@/lib/messages";
import { bankReference } from "@/lib/format";
import { formatEur } from "@/lib/mail-layout";

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
 * - body.method: "card" (по подразбиране, ако Stripe е настроен) | "bank"
 * - планът чака плащането; след него е "requested" — генерира чак когато
 *   админът насрочи първия обход
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

    const own = db.select().from(plans).where(eq(plans.property_id, prop.id)).all();
    const existing = own.find((p) => p.status !== "pending_payment" && isLivePlan(p, todaySofia()));
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
    // Плаща се при заявката (въпрос 4): с карта през Stripe или по банка —
    // и в двата случая планът чака плащането, преди да стигне до насрочване.
    // Админ, който заявява от името на клиента, е случаят „по банка".
    const payByCard = isStripeConfigured() && session.role === "client" && body.method !== "bank";

    // Изоставена заявка, която още чака плащане, не блокира нова — отказва се
    // и страницата ѝ в Stripe се затваря, за да не бъде платена по-късно.
    for (const stale of own.filter((p) => p.status === "pending_payment")) {
      db.update(plans)
        .set({ status: "cancelled", active: false, cancelled_at: new Date().toISOString(), stripe_checkout_session_id: null })
        .where(eq(plans.id, stale.id))
        .run();
      db.update(payments).set({ status: "cancelled" }).where(and(eq(payments.plan_id, stale.id), eq(payments.status, "pending"))).run();
      await expirePlanCheckout(stale.id);
    }
    const snapshot = pkg.items
      .filter((i) => i.optional && optionIds.includes(i.id))
      .map((i) => ({ template_id: i.template_id, per_month: i.per_month }));
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
        options_snapshot: JSON.stringify(snapshot),
        season_from: pkg.active_from,
        season_to: pkg.active_to,
        status: "pending_payment",
        active: true,
      })
      .returning()
      .all();

    if (payByCard) {
      const checkoutUrl = await createSubscriptionCheckout(plan.id, prop.owner_id);
      return NextResponse.json({ ...plan, checkout_url: checkoutUrl }, { status: 201 });
    }

    const payment = requestPlanBankPayment(plan.id);
    const vars = { property: prop.name, package: pkg.name, amount: formatEur(price) };
    await notify("plan_bank_requested", { to: prop.owner_id, vars, rows: bankRows(bankReference("plan", plan.id), price), link: propertyLink(prop.id) });
    await notify("plan_new_team", { to: "admins", vars });
    return NextResponse.json({ ...plan, bank: true, payment_id: payment?.id }, { status: 201 });
  } catch (error) {
    console.error("POST plan error:", error);
    return NextResponse.json({ error: "Грешка при заявката за пакет" }, { status: 500 });
  }
});
