import { db } from "@/db";
import { jobs, properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { notify, propertyLink } from "@/lib/messages";
import { formatDateOnly } from "@/lib/format";
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

    // Клиентът е чакал обход, който няма да се случи — трябва да знае;
    // инспекторът — също, за да не отиде напразно.
    const prop = db.select({ name: properties.name, owner_id: properties.owner_id }).from(properties).where(eq(properties.id, job.property_id)).get();
    const vars = { property: prop?.name ?? "Имот", date: formatDateOnly(job.planned_at), reason: normalizedReason };
    if (prop) await notify("visit_cancelled", { to: prop.owner_id, vars, link: propertyLink(job.property_id) });
    if (job.assignee_id) await notify("visit_cancelled_inspector", { to: job.assignee_id, vars });

    return NextResponse.json(updatedJob);
  } catch (error) {
    console.error("POST /api/jobs/[id]/cancel error:", error);
    return NextResponse.json({ error: "Грешка при отказ на задача" }, { status: 500 });
  }
});
