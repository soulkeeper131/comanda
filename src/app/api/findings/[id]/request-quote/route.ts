import { db } from "@/db";
import { findings, properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { notifyAdmins } from "@/lib/notifications";
import { sendEmail, getNotifyEmail } from "@/lib/email";
import { emailLayout } from "@/lib/mail-layout";
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

    notifyAdmins(
      "quote_requested",
      "Клиент иска оферта",
      `${row.finding.title} — ${row.property.name}`,
      "/dashboard",
    );
    sendEmail({
      to: (await getNotifyEmail()) || "",
      subject: `Заявка за оферта: ${row.finding.title} — ${row.property.name}`,
      html: emailLayout({
        title: "Клиент иска оферта",
        rows: [
          ["Имот", row.property.name],
          ["Констатация", row.finding.title],
          ["Описание", row.finding.body],
        ],
        cta: { label: "Изготви оферта" },
      }),
    }).catch(() => {});

    return NextResponse.json(updated);
  } catch (error) {
    console.error("POST /api/findings/[id]/request-quote error:", error);
    return NextResponse.json({ error: "Грешка при заявката" }, { status: 500 });
  }
});
