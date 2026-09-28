import { db } from "@/db";
import { offers, findings, properties, offerPhotos } from "@/db/schema";
import { and, eq, inArray, lte, type SQL } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sendEmail, getNotifyEmail, ownerEmailFor } from "@/lib/email";
import { notifyOwner } from "@/lib/notifications";
import { withAuth } from "@/lib/auth";
import { emailLayout, formatEur } from "@/lib/mail-layout";
import { getPrepayThreshold } from "@/lib/settings";
import {
  awaitsPayment,
  expiryFrom,
  requiresPrepayment,
  type OfferDecision,
} from "@/lib/domain/offers";

export const dynamic = "force-dynamic";

/** Отворените оферти — докато някоя от тях е жива, нова не се издава. */
const LIVE: OfferDecision[] = ["pending", "accepted", "paid", "in_progress"];

/**
 * Маркира изтеклите оферти още при четене — клиентът не бива да вижда
 * „Приемам" на оферта, която вече не важи, само защото cron-ът още не е минал.
 */
function expireStale() {
  const now = new Date().toISOString();
  const stale = db
    .select({ id: offers.id, finding_id: offers.finding_id })
    .from(offers)
    .where(and(eq(offers.decision, "pending"), lte(offers.expires_at, now)))
    .all();
  if (stale.length === 0) return;
  db.update(offers)
    .set({ decision: "expired" })
    .where(inArray(offers.id, stale.map((o) => o.id)))
    .run();
  // Констатацията се връща в състояние, от което може да се поиска нова оферта.
  db.update(findings)
    .set({ status: "open" })
    .where(and(inArray(findings.id, stale.map((o) => o.finding_id)), eq(findings.status, "quoted")))
    .run();
}

// GET /api/offers?finding_id=X&decision=pending
export const GET = withAuth({}, async (request, { session }) => {
  try {
    expireStale();

    const { searchParams } = new URL(request.url);
    const findingId = searchParams.get("finding_id");
    const decisionFilter = searchParams.get("decision");

    const conditions: SQL[] = [];
    if (findingId) conditions.push(eq(offers.finding_id, findingId));
    if (decisionFilter) conditions.push(eq(offers.decision, decisionFilter as OfferDecision));
    // Клиентът вижда само офертите по своите имоти (оферта → констатация → имот)
    if (session.role === "client") conditions.push(eq(properties.owner_id, session.uid));

    const rows = db
      .select({ offer: offers, finding: findings, property: properties })
      .from(offers)
      .innerJoin(findings, eq(offers.finding_id, findings.id))
      .innerJoin(properties, eq(findings.property_id, properties.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(offers.sent_at)
      .all()
      .reverse();

    const ids = rows.map((r) => r.offer.id);
    const photos = ids.length
      ? db.select().from(offerPhotos).where(inArray(offerPhotos.offer_id, ids)).all()
      : [];
    const threshold = getPrepayThreshold();

    return NextResponse.json(
      rows.map(({ offer, finding, property }) => ({
        ...offer,
        requires_prepayment: requiresPrepayment(offer.price, threshold),
        awaits_payment: awaitsPayment(offer.decision as OfferDecision, offer.price, threshold),
        photos: photos
          .filter((p) => p.offer_id === offer.id)
          .map((p) => ({ id: p.id, storage_path: p.storage_path, taken_at: p.taken_at })),
        finding: {
          id: finding.id,
          title: finding.title,
          body: finding.body,
          status: finding.status,
          severity: finding.severity,
          property_id: finding.property_id,
          property_name: property.name,
          created_at: finding.created_at,
        },
      })),
    );
  } catch (error) {
    console.error("GET /api/offers error:", error);
    return NextResponse.json({ error: "Грешка при зареждане на оферти" }, { status: 500 });
  }
});

// POST /api/offers — нова оферта по констатация (само админ)
export const POST = withAuth({ role: ["admin"] }, async (request, { session }) => {
  try {
    const body = await request.json();
    const { finding_id, days, scope } = body;
    const price = parseFloat(body.price);
    const daysNum = parseInt(days, 10);

    if (!finding_id) {
      return NextResponse.json({ error: "finding_id е задължително" }, { status: 400 });
    }
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(daysNum) || daysNum <= 0 || !scope?.trim()) {
      return NextResponse.json({ error: "Цена, срок и обхват са задължителни" }, { status: 400 });
    }

    const finding = db.select().from(findings).where(eq(findings.id, finding_id)).get();
    if (!finding) {
      return NextResponse.json({ error: "Констатацията не е намерена" }, { status: 404 });
    }

    const live = db
      .select({ id: offers.id })
      .from(offers)
      .where(and(eq(offers.finding_id, finding_id), inArray(offers.decision, LIVE)))
      .get();
    if (live) {
      return NextResponse.json(
        { error: "По тази констатация вече има активна оферта" },
        { status: 409 },
      );
    }

    const now = new Date();
    const [offer] = db
      .insert(offers)
      .values({
        finding_id,
        price,
        days: daysNum,
        scope: scope.trim(),
        decision: "pending",
        created_by: session.uid,
        sent_at: now.toISOString(),
        expires_at: expiryFrom(now),
      })
      .returning()
      .all();

    db.update(findings).set({ status: "quoted" }).where(eq(findings.id, finding_id)).run();

    const property = db.select().from(properties).where(eq(properties.id, finding.property_id)).get();
    const propertyName = property?.name || "Имот";
    const prepay = requiresPrepayment(price, getPrepayThreshold());
    const html = emailLayout({
      title: "Нова оферта",
      intro: `Изготвихме оферта за <strong>${propertyName.replace(/</g, "&lt;")}</strong>. Валидна е 7 дни.`,
      rows: [
        ["Констатация", finding.title],
        ["Цена", formatEur(price)],
        ["Срок за изпълнение", `${daysNum} дни`],
        ["Обхват", scope.trim()],
        ["Плащане", prepay ? "Предварително, след приемане" : "След завършване на работата"],
      ],
      cta: { label: "Виж офертата" },
    });
    const subject = `Нова оферта за ${propertyName}: ${formatEur(price)}`;

    sendEmail({ to: (await getNotifyEmail()) || "", subject, html }).catch(() => {});
    const ownerEmail = ownerEmailFor(finding.property_id);
    if (ownerEmail) sendEmail({ to: ownerEmail, subject, html }).catch(() => {});
    notifyOwner(finding.property_id, "offer_new", "Нова оферта", `${finding.title} — ${formatEur(price)}`, "/dashboard");

    return NextResponse.json(offer, { status: 201 });
  } catch (error) {
    console.error("POST /api/offers error:", error);
    return NextResponse.json({ error: "Грешка при създаване на оферта" }, { status: 500 });
  }
});
