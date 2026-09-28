import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { getBankDetails, getPrepayThreshold, setSetting } from "@/lib/settings";

function bankView() {
  const b = getBankDetails();
  return { bank_iban: b.iban ?? "", bank_recipient: b.recipient ?? "", bank_name: b.bank ?? "" };
}

export const dynamic = "force-dynamic";

/** GET /api/admin/settings — бизнес настройките, които се менят без код. */
export const GET = withAuth({ role: ["admin"] }, async () => {
  return NextResponse.json({
    prepay_threshold: getPrepayThreshold(),
    ...bankView(),
    cron_configured: Boolean(process.env.CRON_SECRET),
    stripe_configured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
    push_configured: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
  });
});

/** PATCH /api/admin/settings { prepay_threshold } */
export const PATCH = withAuth({ role: ["admin"] }, async (request) => {
  const body = await request.json().catch(() => ({}));
  if (body.prepay_threshold !== undefined) {
    const n = Number(body.prepay_threshold);
    if (!Number.isFinite(n) || n <= 0 || n > 100000) {
      return NextResponse.json({ error: "Прагът е положителна сума в евро" }, { status: 400 });
    }
    setSetting("prepay_threshold", String(n));
  }
  for (const [key, setting] of [
    ["bank_iban", "bank_iban"],
    ["bank_recipient", "bank_recipient"],
    ["bank_name", "bank_name"],
  ] as const) {
    if (typeof body[key] === "string") setSetting(setting, body[key].trim().slice(0, 120));
  }
  return NextResponse.json({ prepay_threshold: getPrepayThreshold(), ...bankView() });
});
