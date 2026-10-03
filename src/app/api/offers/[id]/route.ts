import { db } from "@/db";
import { offers, findings, properties, offerPhotos } from "@/db/schema";
import { settleOfferPayment } from "@/lib/payments";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { bankRows, notify, propertyLink } from "@/lib/messages";
import { bankReference, formatDateOnly } from "@/lib/format";
import { withAuth, canDecideOffer, isAdmin } from "@/lib/auth";
import { formatEur } from "@/lib/mail-layout";
import { getPrepayThreshold } from "@/lib/settings";
import {
  canTransition,
  requiresPrepayment,
  offerPrepay,
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

      const prepay = offerPrepay(existing, threshold);
      if (!canTransition(from, to!, prepay)) {
        return NextResponse.json(
          {
            error: `Офертата е „${LABELS[from]}" и не може да стане „${LABELS[to!]}".`,
            allowed: allowedTransitions(from, prepay),
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
        // Ръчно от админ — плащане по банка. Потвърждава заявения от клиента
        // превод (ако има), прави фактура и уведомява — като при Stripe.
        const settled = await settleOfferPayment({ offerId: existing.id, method: "bank" });
        if (!settled.ok) {
          return NextResponse.json({ error: "Офертата не чака плащане" }, { status: 409 });
        }
        return NextResponse.json(db.select().from(offers).where(eq(offers.id, existing.id)).get());
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
        // Предплащането следва новата цена — 80 € → 800 € не бива да остане
        // „плащане след ремонта".
        updates.requires_prepayment = requiresPrepayment(price, getPrepayThreshold());
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

      const prepay = offerPrepay(updated, threshold);
      const vars = { property: property.name, title: finding.title, amount: formatEur(updated.price) };
      if (to === "accepted") {
        await notify("offer_accepted_team", {
          to: "admins",
          vars: { ...vars, next: prepay ? "С предплащане — започва след плащането." : "Плащане след ремонта — може да започне." },
        });
        // Над прага клиентът трябва да знае как да плати, иначе ремонтът стои.
        if (prepay) {
          await notify("offer_accepted_prepay", {
            to: property.owner_id,
            vars,
            rows: bankRows(bankReference("offer", updated.id), updated.price),
            link: propertyLink(property.id),
          });
        }
      } else if (to === "declined") {
        await notify("offer_declined_team", { to: "admins", vars });
      } else if (to === "in_progress") {
        await notify("repair_started", { to: property.owner_id, vars, link: propertyLink(property.id) });
      } else if (to === "done") {
        await notify("repair_done", {
          to: property.owner_id,
          vars: {
            ...vars,
            next: updated.decision === "done" && !prepay ? `Остава плащането — ${formatEur(updated.price)} (карта или превод от приложението).` : "",
          },
          rows: !prepay ? bankRows(bankReference("offer", updated.id), updated.price) : [],
          link: propertyLink(property.id),
        });
      }
    } else if (body.price !== undefined || body.scope !== undefined || body.days !== undefined) {
      // Променена изпратена оферта — клиентът не бива да остане с имейл със старата цена.
      await notify("offer_updated", {
        to: property.owner_id,
        vars: { title: finding.title, property: property.name, amount: formatEur(updated.price), until: formatDateOnly(updated.expires_at) },
        rows: [
          ["Срок за изпълнение", updated.days ? `${updated.days} дни` : null],
          ["Обхват", updated.scope],
          ["Плащане", offerPrepay(updated, threshold) ? "Предварително, след приемане" : "След завършване на работата"],
        ],
        link: propertyLink(property.id),
      });
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

    const row = loadOffer(existing.id);
    db.delete(offerPhotos).where(eq(offerPhotos.offer_id, existing.id)).run();
    db.delete(offers).where(eq(offers.id, existing.id)).run();
    db.update(findings)
      .set({ status: "open" })
      .where(eq(findings.id, existing.finding_id))
      .run();
    if (row) {
      await notify("offer_withdrawn", {
        to: row.property.owner_id,
        vars: { title: row.finding.title, property: row.property.name },
        link: propertyLink(row.property.id),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/offers/[id] error:", error);
    return NextResponse.json({ error: "Грешка при изтриване на оферта" }, { status: 500 });
  }
});
