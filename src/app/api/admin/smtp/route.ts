import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { smtpSource } from "@/lib/email";
import { withAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function getSettingsMap(): Promise<Record<string, string>> {
  const rows = db.select({ key: settings.key, value: settings.value }).from(settings).all();
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

function upsertSetting(key: string, value: string): void {
  const existing = db.select({ id: settings.id }).from(settings).where(eq(settings.key, key)).get();
  if (existing) {
    db.update(settings).set({ value }).where(eq(settings.key, key)).run();
  } else {
    db.insert(settings).values({ key, value }).run();
  }
}

// GET /api/admin/smtp — настройките на имейл сървъра (без паролата) и откъде идват.
// Ако са в Coolify (SMTP_HOST), те важат и тук само се показват.
export const GET = withAuth({ role: ["admin"] }, async () => {
  try {
    const source = await smtpSource();
    const map = await getSettingsMap();
    const smtp =
      source === "env"
        ? {
            smtp_host: process.env.SMTP_HOST || "",
            smtp_port: process.env.SMTP_PORT || "587",
            smtp_user: process.env.SMTP_USER || "",
            smtp_from: process.env.SMTP_FROM || process.env.SMTP_USER || "",
            notify_email: process.env.NOTIFY_EMAIL || process.env.SMTP_USER || "",
          }
        : map.smtp_host
          ? {
              smtp_host: map.smtp_host,
              smtp_port: map.smtp_port || "587",
              smtp_user: map.smtp_user || "",
              smtp_from: map.smtp_from || "",
              notify_email: map.notify_email || "",
            }
          : null;

    return NextResponse.json({ configured: !!smtp, source, smtp });
  } catch (error) {
    console.error("GET /api/admin/smtp error:", error);
    return NextResponse.json({ error: "Грешка" }, { status: 500 });
  }
});

// POST /api/admin/smtp — записва настройките (само ако не идват от Coolify).
export const POST = withAuth({ role: ["admin"] }, async (request) => {
  try {
    if ((await smtpSource()) === "env") {
      return NextResponse.json({ error: "Имейл сървърът е настроен в Coolify (SMTP_*) — промените се правят там" }, { status: 409 });
    }
    const body = await request.json();
    const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, notify_email } = body;

    // Store SMTP settings in the settings table
    if (smtp_host) {
      upsertSetting("smtp_host", smtp_host);
      upsertSetting("smtp_port", String(smtp_port || 587));
      upsertSetting("smtp_user", smtp_user || "");
      if (smtp_pass) upsertSetting("smtp_pass", smtp_pass);
      upsertSetting("smtp_from", smtp_from || smtp_user || "");
      upsertSetting("notify_email", notify_email || smtp_user || "");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/admin/smtp error:", error);
    return NextResponse.json({ error: "Грешка" }, { status: 500 });
  }
});
