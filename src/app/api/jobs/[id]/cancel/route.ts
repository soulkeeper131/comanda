import { db } from "@/db";
import { jobs, properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sendEmail, getNotifyEmail, ownerEmailFor } from "@/lib/email";
import { withAuth } from "@/lib/auth";
import { canCancelJob } from "@/lib/domain/jobs";
import { normalizeOverrideReason } from "@/lib/domain/overrides";

export const dynamic = "force-dynamic";

// POST /api/jobs/[id]/cancel — отказва задача с причина.
// Админ винаги може. Възложеният инспектор може, докато задачата не е
// завършена — той е този, който може да я е стартирал по грешка.
export const POST = withAuth({ role: ["admin", "inspector"] }, async (request, { session, params }) => {
  try {
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const { reason } = body ?? {};

    const job = db.select().from(jobs).where(eq(jobs.id, id)).get();
    if (!job) {
      return NextResponse.json({ error: "Задачата не е намерена" }, { status: 404 });
    }

    const verdict = canCancelJob(
      { status: job.status ?? "planned", assignee_id: job.assignee_id },
      { isAdmin: session.role === "admin", userId: session.uid },
    );
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.error }, { status: 400 });
    }

    // Причината се валидира сега (за 400 рано), но самата промяна на статус
    // и бележката се записват само след като отказът е сигурен.
    let normalizedReason: string;
    try {
      normalizedReason = normalizeOverrideReason(
        typeof reason === "string" ? reason : "",
      );
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Причината за отказ е задължителна.",
        },
        { status: 400 },
      );
    }

    db.update(jobs)
      .set({ status: "cancelled", note: `Отменена: ${normalizedReason}` })
      .where(eq(jobs.id, id))
      .run();

    const updatedJob = db.select().from(jobs).where(eq(jobs.id, id)).get();

    // Клиентът е чакал обход, който няма да се случи — трябва да знае.
    const [prop] = db.select({ name: properties.name }).from(properties).where(eq(properties.id, job.property_id)).all();
    const propertyName = prop?.name || "Имот";
    const cancelSubject = `❌ Обходът на ${propertyName} е отменен`;
    const cancelHtml = `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #dc2626;">❌ Обходът е отменен</h2>
          <p style="color: #247ba0;"><strong>Имот:</strong> ${propertyName}</p>
          <p style="color: #247ba0;"><strong>Задача:</strong> ${job.title || "Обход"}</p>
          <p style="color: #247ba0;"><strong>Причина:</strong> ${normalizedReason}</p>
          <hr style="border: none; border-top: 1px solid #e4e9f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">Ко Манда — comanda.blv.bg</p>
        </div>
      `;

    sendEmail({
      to: (await getNotifyEmail()) || "",
      subject: cancelSubject,
      html: cancelHtml,
    }).catch(() => {});

    const ownerEmail = ownerEmailFor(job.property_id);
    if (ownerEmail) {
      sendEmail({
        to: ownerEmail,
        subject: cancelSubject,
        html: cancelHtml,
      }).catch(() => {});
    }

    return NextResponse.json(updatedJob);
  } catch (error) {
    console.error("POST /api/jobs/[id]/cancel error:", error);
    return NextResponse.json({ error: "Грешка при отказ на задача" }, { status: 500 });
  }
});
