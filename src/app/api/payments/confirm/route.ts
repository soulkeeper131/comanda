import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { db } from "@/db";
import { payments, offers, invoices, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail, getNotifyEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/**
 * POST /api/payments/confirm
 * Body: { paymentId }
 *
 * Ръчно потвърждаване на плащане (за банкови преводи и тестови цели).
 * Същият flow като Stripe webhook — маркира payment като paid,
 * ъпдейтва offer, създава invoice.
 */
export const POST = withAuth({ role: ["admin"] }, async (request) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { paymentId } = body;

    if (!paymentId) {
      return NextResponse.json(
        { error: "paymentId е задължително" },
        { status: 400 }
      );
    }

    const payment = db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .get();

    if (!payment) {
      return NextResponse.json(
        { error: "Плащането не е намерено" },
        { status: 404 }
      );
    }

    if (payment.status === "paid") {
      return NextResponse.json(
        { error: "Плащането вече е маркирано като платено" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // 1. Ъпдейт payment
    db.update(payments)
      .set({
        status: "paid",
        paid_at: now,
      })
      .where(eq(payments.id, paymentId))
      .run();

    // 2. Ако има offer_id → ъпдейтвай offer flow (accepted → paid)
    if (payment.offer_id) {
      const offer = db
        .select()
        .from(offers)
        .where(eq(offers.id, payment.offer_id))
        .get();

      if (offer && offer.decision === "accepted") {
        db.update(offers)
          .set({ decision: "paid" })
          .where(eq(offers.id, payment.offer_id))
          .run();
      }
    }

    // 3. Създай invoice
    const user = db
      .select({ full_name: users.full_name, email: users.email })
      .from(users)
      .where(eq(users.id, payment.user_id))
      .get();

    const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}-${paymentId.slice(0, 4).toUpperCase()}`;
    const description = payment.offer_id
      ? `Плащане по оферта #${payment.offer_id.slice(0, 8)}`
      : payment.method === "transfer"
        ? `Банков превод`
        : `Плащане`;

    const invoiceId = crypto.randomUUID();
    db.insert(invoices)
      .values({
        id: invoiceId,
        user_id: payment.user_id,
        payment_id: paymentId,
        number: invoiceNumber,
        amount: payment.amount,
        description,
      })
      .run();

    // 4. Нотификации
    const userName = user?.full_name || user?.email || "Клиент";

    createNotification(
      payment.user_id,
      "offer_decided",
      "✅ Плащането е потвърдено",
      `Плащане от ${payment.amount.toFixed(2)}€ е потвърдено. Фактура: ${invoiceNumber}`,
      "/dashboard/payments"
    );

    // Email
    const notifyEmail = await getNotifyEmail();
    if (notifyEmail && user?.email) {
      sendEmail({
        to: notifyEmail,
        subject: `💰 Плащане потвърдено: ${payment.amount.toFixed(2)}€ от ${userName}`,
        html: `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;background:#e8f1f2;border-radius:12px">
            <h2 style="color:#006494">💰 Плащане потвърдено</h2>
            <p style="color:#247ba0"><strong>Клиент:</strong> ${userName}</p>
            <p style="color:#247ba0"><strong>Сума:</strong> ${payment.amount.toFixed(2)}€</p>
            <p style="color:#247ba0"><strong>Метод:</strong> ${payment.method === "transfer" ? "Банков превод" : "Карта"}</p>
            <p style="color:#247ba0"><strong>Фактура:</strong> ${invoiceNumber}</p>
            <hr style="border:none;border-top:1px solid #e4e9f0;margin:20px 0" />
            <p style="color:#94a3b8;font-size:12px">Ко Манда — comanda.blv.bg</p>
          </div>
        `,
      }).catch(() => {});

      sendEmail({
        to: user.email,
        subject: `✅ Плащането от ${payment.amount.toFixed(2)}€ е потвърдено`,
        html: `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px;background:#e8f1f2;border-radius:12px">
            <h2 style="color:#16a34a">✅ Плащането е потвърдено</h2>
            <p style="color:#247ba0">Вашето плащане от <strong>${payment.amount.toFixed(2)}€</strong> е потвърдено.</p>
            <p style="color:#247ba0"><strong>Фактура:</strong> ${invoiceNumber}</p>
            <a href="https://comanda.blv.bg/dashboard/payments" style="display:inline-block;padding:12px 24px;background:#1b98e0;color:#fff;border-radius:8px;text-decoration:none;margin-top:12px">Към таблото</a>
            <hr style="border:none;border-top:1px solid #e4e9f0;margin:20px 0" />
            <p style="color:#94a3b8;font-size:12px">Ко Манда — comanda.blv.bg</p>
          </div>
        `,
      }).catch(() => {});
    }

    // Върни обновения payment
    const updated = db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .get();

    return NextResponse.json({
      payment: updated,
      invoice: { id: invoiceId, number: invoiceNumber },
    });
  } catch (error: any) {
    console.error("[payments/confirm] Error:", error);
    return NextResponse.json(
      { error: "Грешка при потвърждаване на плащане" },
      { status: 500 }
    );
  }
});
