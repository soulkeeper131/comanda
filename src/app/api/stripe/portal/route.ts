import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { createPortalSession } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

/** POST /api/stripe/portal — страницата на Stripe за карта и история на плащанията. */
export const POST = withAuth({ role: ["client"] }, async (_request, { session }) => {
  try {
    const url = await createPortalSession(session.uid);
    if (!url) return NextResponse.json({ error: "Още нямате плащания с карта" }, { status: 404 });
    return NextResponse.json({ url });
  } catch (error) {
    console.error("[stripe/portal]", error);
    return NextResponse.json({ error: "Stripe не отговори — опитайте пак" }, { status: 502 });
  }
});
