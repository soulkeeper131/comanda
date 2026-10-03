import { db } from "@/db";
import { findings, properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { notify } from "@/lib/messages";
import { canRequestQuote } from "@/lib/domain/findings";

export const dynamic = "force-dynamic";

/**
 * POST /api/findings/[id]/request-quote — „Искам оферта" (въпрос 19).
 * Само собственикът на имота. Заявката става работна опашка за админа.
 */
export const POST = withAuth({ role: ["client"] }, async (_request, { session, params }) => {
  try {
    const row = db
      .select({ finding: findings, property: properties })
      .from(findings)
      .innerJoin(properties, eq(findings.property_id, properties.id))
      .where(eq(findings.id, params.id))
      .get();

    if (!row || row.property.owner_id !== session.uid) {
      return NextResponse.json({ error: "Констатацията не е намерена" }, { status: 404 });
    }
    if (!canRequestQuote(row.finding.status)) {
      return NextResponse.json(
        { error: "За тази констатация вече има заявка или оферта" },
        { status: 409 },
      );
    }

    const [updated] = db
      .update(findings)
      .set({ status: "quote_requested", quote_requested_at: new Date().toISOString() })
      .where(eq(findings.id, params.id))
      .returning()
      .all();

    await notify("quote_requested", {
      to: "admins",
      vars: { title: row.finding.title, property: row.property.name },
      rows: [["Описание", row.finding.body]],
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("POST /api/findings/[id]/request-quote error:", error);
    return NextResponse.json({ error: "Грешка при заявката" }, { status: 500 });
  }
});
