import { db } from "@/db";
import { jobs, properties, serviceTemplates, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const POST = withAuth({ role: ["admin"] }, async (request, { session }) => {
  try {
    const body = await request.json();
    const {
      property_ids,
      template_id,
      assignee_id,
      planned_at,
      title: bodyTitle,
    } = body;

    if (
      !property_ids ||
      !Array.isArray(property_ids) ||
      property_ids.length === 0
    ) {
      return NextResponse.json(
        { error: "Избери поне един имот" },
        { status: 400 }
      );
    }

    if (!planned_at) {
      return NextResponse.json(
        { error: "Планирана дата е задължителна" },
        { status: 400 }
      );
    }

    // Изпълнителят — само активен инспектор (както при единичен обход).
    if (assignee_id) {
      const person = db.select().from(users).where(eq(users.id, assignee_id)).get();
      if (!person || person.role !== "inspector" || person.active === false) {
        return NextResponse.json({ error: "Изберете активен инспектор" }, { status: 400 });
      }
    }

    let templateData = null;
    if (template_id) {
      templateData = db
        .select()
        .from(serviceTemplates)
        .where(eq(serviceTemplates.id, template_id))
        .get();
    }

    const createdJobIds: string[] = [];

    const skipped: string[] = [];
    for (const property_id of property_ids) {
      const property = db.select().from(properties).where(eq(properties.id, property_id)).get();
      // Неодобрен или архивиран имот не получава обходи — пропуска се, не
      // проваля цялото възлагане.
      if (!property || property.archived || property.status !== "active") {
        skipped.push(property_id);
        continue;
      }
      const jobTitle =
        bodyTitle ||
        (templateData ? `${templateData.name} — ${property.name}` : `Обход — ${property.name}`);

      // RETURNING — не „последния по created_at", който в една секунда
      // връща чужд ред.
      const [job] = db
        .insert(jobs)
        .values({
          org_id: session.org_id,
          property_id,
          assignee_id: assignee_id || property.assigned_inspector_id || null,
          template_id: template_id || null,
          title: jobTitle,
          duration_min: templateData?.duration_min ?? null,
          planned_at,
          status: "planned",
        })
        .returning()
        .all();
      createdJobIds.push(job.id);
    }

    return NextResponse.json(
      {
        created: createdJobIds.length,
        job_ids: createdJobIds,
        skipped,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/jobs/bulk error:", error);
    return NextResponse.json(
      { error: "Грешка при създаване на задачи" },
      { status: 500 }
    );
  }
});
