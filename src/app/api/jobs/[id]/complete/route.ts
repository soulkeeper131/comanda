import { db } from "@/db";
import { jobs, jobItems, properties } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { sendEmail, getNotifyEmail } from "@/lib/email";
import { notifyOwner } from "@/lib/notifications";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const POST = withAuth({ role: ["admin", "inspector"] }, async (_request, { params }) => {
  try {
    const { id } = params;

    // Get the job
    const job = db.select().from(jobs).where(eq(jobs.id, id)).get();
    if (!job) {
      return NextResponse.json({ error: "Задачата не е намерена" }, { status: 404 });
    }

    if (job.status !== "in_progress") {
      return NextResponse.json(
        { error: "Само задача в прогрес може да бъде завършена" },
        { status: 400 }
      );
    }

    // Get all required items that are NOT done
    const undoneRequired = db
      .select()
      .from(jobItems)
      .where(
        and(
          eq(jobItems.job_id, id),
          eq(jobItems.required, true),
          eq(jobItems.done, false)
        )
      )
      .all();

    if (undoneRequired.length > 0) {
      return NextResponse.json(
        {
          error: "Не всички задължителни стъпки са изпълнени",
          undone_items: undoneRequired.map((item) => ({
            id: item.id,
            label: item.label,
            zone_label: item.zone_label,
          })),
        },
        { status: 400 }
      );
    }

    // All required items done — complete the job
    const now = new Date().toISOString();
    db.update(jobs)
      .set({ status: "completed", check_out: now })
      .where(eq(jobs.id, id))
      .run();

    const updatedJob = db.select().from(jobs).where(eq(jobs.id, id)).get();
    const items = db.select().from(jobItems).where(eq(jobItems.job_id, id)).all();

    // Send email notification
    const [prop] = db.select({ name: properties.name }).from(properties).where(eq(properties.id, job.property_id)).all();
    const propertyName = prop?.name || "Имот";
    sendEmail({
      to: (await getNotifyEmail()) || "",
      subject: `✅ Обходът на ${propertyName} е завършен`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #16a34a;">✅ Обходът е завършен</h2>
          <p style="color: #247ba0;"><strong>Имот:</strong> ${propertyName}</p>
          <p style="color: #247ba0;"><strong>Задача:</strong> ${job.title || "Обход"}</p>
          <p style="color: #247ba0;"><strong>Завършен на:</strong> ${new Date().toLocaleString("bg-BG")}</p>
          <hr style="border: none; border-top: 1px solid #e4e9f0; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 12px;">Ко Манда — comanda.blv.bg</p>
        </div>
      `,
    }).catch(() => {});

    return NextResponse.json({ ...updatedJob, items });
  } catch (error) {
    console.error("POST /api/jobs/[id]/complete error:", error);
    return NextResponse.json({ error: "Грешка при завършване на задача" }, { status: 500 });
  }
});
