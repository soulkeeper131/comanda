import { db } from "@/db";
import { offers, findings, properties, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sendEmail, getNotifyEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// PATCH /api/offers/[id] — обновява оферта (decision, scope, price, days)
// Авторизация: всеки автентикиран потребител. Валидацията на преходите
// между статусите (pending → accepted → paid → ...) е обхват на Task 13,
// не на тази задача.
export const PATCH = withAuth({}, async (request, { params }) => {
  try {
    const { id } = params;
    const body = await request.json();

    // Check offer exists
    const [existing] = await db
      .select()
      .from(offers)
      .where(eq(offers.id, id));
    if (!existing) {
      return NextResponse.json(
        { error: "Офертата не е намерена" },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};

    if (body.decision !== undefined) {
      const VALID_DECISIONS = ["pending", "accepted", "declined", "paid", "in_progress", "done"];
      if (!VALID_DECISIONS.includes(body.decision)) {
        return NextResponse.json(
          { error: `Невалиден статус. Позволени: ${VALID_DECISIONS.join(", ")}` },
          { status: 400 }
        );
      }
      updates.decision = body.decision;
    }

    if (body.scope !== undefined) {
      updates.scope = body.scope;
    }

    if (body.price !== undefined) {
      updates.price = parseFloat(body.price);
    }

    if (body.days !== undefined) {
      updates.days = parseInt(body.days, 10);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Няма полета за обновяване" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(offers)
      .set(updates)
      .where(eq(offers.id, id))
      .returning();

    // Send email notification for accept/decline
    if (body.decision === "accepted" || body.decision === "declined") {
      const decisionLabel = body.decision === "accepted" ? "приета" : "отказана";
      const emoji = body.decision === "accepted" ? "✅" : "❌";
      const [finding] = await db.select().from(findings).where(eq(findings.id, existing.finding_id)).all();
      sendEmail({
        to: (await getNotifyEmail()) || "",
        subject: `${emoji} Офертата е ${decisionLabel}`,
        html: `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
            <h2 style="color: ${body.decision === "accepted" ? "#16a34a" : "#dc2626"};">${emoji} Офертата е ${decisionLabel}</h2>
            ${finding ? `<p style="color: #247ba0;"><strong>Констатация:</strong> ${finding.title}</p>` : ""}
            <p style="color: #247ba0;"><strong>Цена:</strong> ${existing.price} лв</p>
            <p style="color: #247ba0;"><strong>Срок:</strong> ${existing.days} дни</p>
            ${existing.scope ? `<p style="color: #247ba0;"><strong>Обхват:</strong> ${existing.scope}</p>` : ""}
            <hr style="border: none; border-top: 1px solid #e4e9f0; margin: 20px 0;" />
            <p style="color: #94a3b8; font-size: 12px;">Ко Манда — comanda.blv.bg</p>
          </div>
        `,
      }).catch(() => {});
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/offers/[id] error:", error);
    return NextResponse.json(
      { error: "Грешка при обновяване на оферта" },
      { status: 500 }
    );
  }
});

// DELETE /api/offers/[id] — изтрива оферта (само ако е pending)
export const DELETE = withAuth({ role: ["admin"] }, async (request, { params }) => {
  try {
    const { id } = params;

    const [existing] = await db
      .select()
      .from(offers)
      .where(eq(offers.id, id));
    if (!existing) {
      return NextResponse.json(
        { error: "Офертата не е намерена" },
        { status: 404 }
      );
    }

    if (existing.decision !== "pending") {
      return NextResponse.json(
        { error: "Може да се изтрие само оферта със статус 'pending'" },
        { status: 400 }
      );
    }

    await db.delete(offers).where(eq(offers.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/offers/[id] error:", error);
    return NextResponse.json(
      { error: "Грешка при изтриване на оферта" },
      { status: 500 }
    );
  }
});
