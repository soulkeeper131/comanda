import { db } from "@/db";
import { findings, offers } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAuth, isAdmin } from "@/lib/auth";
import { FINDING_STATUSES, isFindingStatus, isSeverity } from "@/lib/domain/findings";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/findings/[id] — корекция на текст/спешност (админ или
 * инспекторът, който я е докладвал) и затваряне (само админ).
 * Имотът и обходът не се сменят — констатацията остава там, където е видяна.
 */
export const PATCH = withAuth({ role: ["admin", "inspector"] }, async (request, { session, params }) => {
  try {
    const existing = db.select().from(findings).where(eq(findings.id, params.id)).get();
    if (!existing || (!isAdmin(session) && existing.reported_by !== session.uid)) {
      return NextResponse.json({ error: "Констатацията не е намерена" }, { status: 404 });
    }

    const body = await request.json();
    const updates: Partial<typeof findings.$inferInsert> = {};

    if (body.status !== undefined) {
      if (!isAdmin(session)) {
        return NextResponse.json({ error: "Само админ сменя статуса" }, { status: 403 });
      }
      if (!isFindingStatus(body.status)) {
        return NextResponse.json(
          { error: `Невалиден статус. Позволени: ${FINDING_STATUSES.join(", ")}` },
          { status: 400 },
        );
      }
      if (body.status === "closed") {
        const live = db
          .select({ id: offers.id })
          .from(offers)
          .where(and(eq(offers.finding_id, existing.id), inArray(offers.decision, ["pending", "accepted", "paid", "in_progress"])))
          .get();
        if (live) {
          return NextResponse.json(
            { error: "По констатацията има активна оферта — първо я завършете или изтрийте" },
            { status: 409 },
          );
        }
      }
      updates.status = body.status;
    }
    if (body.severity !== undefined) {
      if (!isSeverity(body.severity)) {
        return NextResponse.json({ error: "Невалидна спешност" }, { status: 400 });
      }
      updates.severity = body.severity;
    }
    if (typeof body.title === "string" && body.title.trim()) updates.title = body.title.trim();
    if (typeof body.body === "string") updates.body = body.body;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Няма полета за обновяване" }, { status: 400 });
    }

    const [updated] = db.update(findings).set(updates).where(eq(findings.id, params.id)).returning().all();
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/findings/[id] error:", error);
    return NextResponse.json({ error: "Грешка при обновяване на констатация" }, { status: 500 });
  }
});
