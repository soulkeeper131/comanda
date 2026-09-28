import { db } from "@/db";
import { offers, findings, properties, payments, offerPhotos } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sendEmail, getNotifyEmail, ownerEmailFor } from "@/lib/email";
import { notifyOwner } from "@/lib/notifications";
import { withAuth, canDecideOffer, isAdmin } from "@/lib/auth";
import { emailLayout, formatEur } from "@/lib/mail-layout";
import { getPrepayThreshold } from "@/lib/settings";
import {
  canTransition,
  allowedTransitions,
  isValidDecision,
  isExpired,
  VALID_DECISIONS,
  type OfferDecision,
} from "@/lib/domain/offers";

export const dynamic = "force-dynamic";

const LABELS: Record<OfferDecision, string> = {
  pending: "чака решение",
  accepted: "приета",
  declined: "отказана",
  expired: "изтекла",
  paid: "платена",
  in_progress: "в изпълнение",
  done: "завършена",
};

function loadOffer(id: string) {
  return db
    .select({ offer: offers, finding: findings, property: properties })
    .from(offers)
    .innerJoin(findings, eq(offers.finding_id, findings.id))
    .innerJoin(properties, eq(findings.property_id, properties.id))
    .where(eq(offers.id, id))
    .get();
}

// PATCH /api/offers/[id]
// Кой има право на кой преход:
//   pending → accepted/declined: само собственикът на имота (админът не решава вместо него)
//   → paid: Stripe webhook-ът, или админ при плащане по банка (записва се плащане)
//   → in_progress, → done: само админ (ремонтът се изпълнява от външен майстор)
export const PATCH = withAuth({}, async (request, { session, params }) => {
  try {
    const row = loadOffer(params.id);
    if (!row || (session.role === "client" && row.property.owner_id !== session.uid)) {
      return NextResponse.json({ error: "Офертата не е намерена" }, { status: 404 });
    }
    const { offer: existing, finding, property } = row;
    const body = await request.json();
    const updates: Partial<typeof offers.$inferInsert> = {};
    const now = new Date().toISOString();
    const threshold = getPrepayThreshold();

    let to: OfferDecision | null = null;
    if (body.decision !== undefined) {
      if (!isValidDecision(body.decision)) {
        return NextResponse.json(
          { error: `Невалиден статус. Позволени: ${VALID_DECISIONS.join(", ")}` },
          { status: 400 },
        );
      }
      to = body.decision;
      const from = (existing.decision ?? "pending") as OfferDecision;

      if (isExpired(existing)) {
        db.update(offers).set({ decision: "expired" }).where(eq(offers.id, existing.id)).run();
        db.update(findings).set({ status: "open" }).where(eq(findings.id, finding.id)).run();
        return NextResponse.json(
          { error: "Офертата е изтекла. Можете да поискате нова оферта по констатацията." },
          { status: 410 },
        );
      }

      if (!canTransition(from, to!, existing.price, threshold)) {
        return NextResponse.json(
          {
            error: `Офертата е „${LABELS[from]}" и не може да стане „${LABELS[to!]}".`,
            allowed: allowedTransitions(from, existing.price, threshold),
          },
          { status: 400 },
        );
      }

      if (to === "accepted" || to === "declined") {
        if (!canDecideOffer(session, property)) {
          return NextResponse.json(
            { error: "Само собственикът на имота може да приеме или откаже оферта" },
            { status: 403 },
          );
        }
        updates.decided_at = now;
      } else if (!isAdmin(session)) {
        return NextResponse.json({ error: "Само админ може да променя този статус" }, { status: 403 });
      }

      if (to === "paid") {
        // Ръчно отбелязване от админ — плащане по банка (въпрос 4: при 10–50
        // клиента парите се събират по банка). Записва се като плащане.
        updates.paid_at = now;
        db.insert(payments)
          .values({
            user_id: property.owner_id,
            offer_id: existing.id,
            amount: existing.price ?? 0,
            status: "paid",
            method: "bank",
            paid_at: now,
          })
          .run();
      }
      if (to === "done") updates.done_at = now;
      updates.decision = to!;
    }

    if (body.scope !== undefined || body.price !== undefined || body.days !== undefined) {
      if (!isAdmin(session)) {
        return NextResponse.json({ error: "Само админ може да променя офертата" }, { status: 403 });
      }
      if (existing.decision !== "pending") {
        return NextResponse.json(
          { error: "Офертата може да се променя само докато чака решение" },
          { status: 400 },
        );
      }
      if (body.scope !== undefined) updates.scope = String(body.scope);
      if (body.price !== undefined) {
        const price = parseFloat(body.price);
        if (!Number.isFinite(price) || price <= 0) {
          return NextResponse.json({ error: "Невалидна цена" }, { status: 400 });
        }
        updates.price = price;
      }
      if (body.days !== undefined) updates.days = parseInt(body.days, 10) || existing.days;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Няма полета за обновяване" }, { status: 400 });
    }

    const [updated] = db.update(offers).set(updates).where(eq(offers.id, existing.id)).returning().all();

    if (to) {
      // Констатацията следва офертата: отказ → пак може да се поиска оферта;
      // завършен ремонт → констатацията е затворена.
      if (to === "declined") {
        db.update(findings).set({ status: "open" }).where(eq(findings.id, finding.id)).run();
      } else if (to === "done") {
        db.update(findings).set({ status: "closed" }).where(eq(findings.id, finding.id)).run();
      }

      const subject = `Офертата за ${property.name} е ${LABELS[to]}`;
      const html = emailLayout({
        title: `Офертата е ${LABELS[to]}`,
        rows: [
          ["Имот", property.name],
          ["Констатация", finding.title],
          ["Цена", formatEur(existing.price)],
          ["Обхват", existing.scope],
        ],
        color: to === "declined" ? "#dc2626" : "#16a34a",
        cta: { label: "Отвори приложението" },
      });

      if (to === "accepted" || to === "declined") {
        // Решението на клиента — към екипа.
        sendEmail({ to: (await getNotifyEmail()) || "", subject, html }).catch(() => {});
      } else {
        // Движение по ремонта — към клиента.
        const ownerEmail = ownerEmailFor(property.id);
        if (ownerEmail) sendEmail({ to: ownerEmail, subject, html }).catch(() => {});
        notifyOwner(property.id, "offer_decided", `Ремонтът е ${LABELS[to]}`, finding.title, "/dashboard");
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/offers/[id] error:", error);
    return NextResponse.json({ error: "Грешка при обновяване на оферта" }, { status: 500 });
  }
});

// DELETE /api/offers/[id] — изтрива оферта (само ако чака решение)
export const DELETE = withAuth({ role: ["admin"] }, async (_request, { params }) => {
  try {
    const existing = db.select().from(offers).where(eq(offers.id, params.id)).get();
    if (!existing) {
      return NextResponse.json({ error: "Офертата не е намерена" }, { status: 404 });
    }
    if (existing.decision !== "pending") {
      return NextResponse.json({ error: "Може да се изтрие само оферта, която чака решение" }, { status: 400 });
    }

    db.delete(offerPhotos).where(eq(offerPhotos.offer_id, existing.id)).run();
    db.delete(offers).where(eq(offers.id, existing.id)).run();
    db.update(findings)
      .set({ status: "open" })
      .where(eq(findings.id, existing.finding_id))
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/offers/[id] error:", error);
    return NextResponse.json({ error: "Грешка при изтриване на оферта" }, { status: 500 });
  }
});
