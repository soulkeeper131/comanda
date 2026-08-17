import { db } from "@/db";
import { jobs, properties, serviceTemplates } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
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

    let templateData = null;
    if (template_id) {
      templateData = db
        .select()
        .from(serviceTemplates)
        .where(eq(serviceTemplates.id, template_id))
        .get();
    }

    const createdJobIds: string[] = [];

    for (const property_id of property_ids) {
      let jobTitle = bodyTitle || null;
      let durationMin: number | null = null;

      if (templateData) {
        durationMin = templateData.duration_min ?? null;
        if (!jobTitle) {
          const property = db
            .select()
            .from(properties)
            .where(eq(properties.id, property_id))
            .get();
          jobTitle = `${templateData.name} - ${property?.name || "Имот"}`;
        }
      }

      if (!jobTitle) {
        const property = db
          .select()
          .from(properties)
          .where(eq(properties.id, property_id))
          .get();
        jobTitle = `Обход - ${property?.name || "Имот"}`;
      }

      db.insert(jobs)
        .values({
          org_id: session.org_id,
          property_id,
          assignee_id: assignee_id || null,
          template_id: template_id || null,
          title: jobTitle,
          duration_min: durationMin,
          planned_at,
          status: "planned",
        })
        .run();

      // Fetch last inserted job for this batch
      const [lastJob] = db
        .select()
        .from(jobs)
        .orderBy(desc(jobs.created_at))
        .limit(1)
        .all();
      if (lastJob) {
        createdJobIds.push(lastJob.id);
      }
    }

    return NextResponse.json(
      {
        created: createdJobIds.length,
        job_ids: createdJobIds,
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
