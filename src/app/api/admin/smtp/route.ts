import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAllTemplates } from "@/lib/email";

export const dynamic = "force-dynamic";

const SMTP_KEYS = ["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_from", "notify_email"] as const;

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

// GET /api/admin/smtp — returns SMTP settings + email templates
export async function GET() {
  try {
    const map = await getSettingsMap();
    const smtp = map.smtp_host
      ? {
          smtp_host: map.smtp_host,
          smtp_port: map.smtp_port || "587",
          smtp_user: map.smtp_user || "",
          smtp_from: map.smtp_from || "",
          notify_email: map.notify_email || "",
        }
      : null;

    const templates = await getAllTemplates();

    return NextResponse.json({ configured: !!smtp, smtp, templates });
  } catch (error) {
    console.error("GET /api/admin/smtp error:", error);
    return NextResponse.json({ error: "Грешка" }, { status: 500 });
  }
}

// POST /api/admin/smtp — saves SMTP settings + optional email_templates
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, notify_email, email_templates } = body;

    // Store SMTP settings in the settings table
    if (smtp_host) {
      upsertSetting("smtp_host", smtp_host);
      upsertSetting("smtp_port", String(smtp_port || 587));
      upsertSetting("smtp_user", smtp_user || "");
      if (smtp_pass) upsertSetting("smtp_pass", smtp_pass);
      upsertSetting("smtp_from", smtp_from || smtp_user || "");
      upsertSetting("notify_email", notify_email || smtp_user || "");
    }

    // Store email_templates in settings table as JSON
    if (email_templates) {
      upsertSetting("email_templates", JSON.stringify(email_templates));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/admin/smtp error:", error);
    return NextResponse.json({ error: "Грешка" }, { status: 500 });
  }
}
