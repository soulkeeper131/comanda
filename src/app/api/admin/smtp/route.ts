import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/admin/smtp — връща текущите SMTP настройки (без парола)
export async function GET() {
  try {
    const [org] = db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, "org1"))
      .all();

    if (!org?.settings) {
      return NextResponse.json({ configured: false });
    }

    const parsed = JSON.parse(org.settings);
    const smtp = parsed.smtp_host
      ? {
          smtp_host: parsed.smtp_host,
          smtp_port: parsed.smtp_port || 587,
          smtp_user: parsed.smtp_user || "",
          smtp_from: parsed.smtp_from || "",
          notify_email: parsed.notify_email || "",
        }
      : null;

    return NextResponse.json({
      configured: !!smtp,
      smtp,
    });
  } catch (error) {
    console.error("GET /api/admin/smtp error:", error);
    return NextResponse.json({ error: "Грешка при зареждане на настройки" }, { status: 500 });
  }
}

// POST /api/admin/smtp — записва SMTP настройки
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, notify_email } = body;

    if (!smtp_host) {
      return NextResponse.json({ error: "SMTP Host е задължителен" }, { status: 400 });
    }

    // Get existing settings or create new
    const [existing] = db
      .select({ id: organizations.id, settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, "org1"))
      .all();

    let currentSettings: Record<string, unknown> = {};
    if (existing?.settings) {
      try {
        currentSettings = JSON.parse(existing.settings);
      } catch {
        currentSettings = {};
      }
    }

    currentSettings.smtp_host = smtp_host;
    currentSettings.smtp_port = smtp_port || 587;
    currentSettings.smtp_user = smtp_user || "";
    // Only update password if provided
    if (smtp_pass) {
      currentSettings.smtp_pass = smtp_pass;
    }
    currentSettings.smtp_from = smtp_from || smtp_user || "";
    currentSettings.notify_email = notify_email || smtp_user || "";

    const settingsJson = JSON.stringify(currentSettings);

    if (existing) {
      db.update(organizations)
        .set({ settings: settingsJson })
        .where(eq(organizations.id, "org1"))
        .run();
    } else {
      db.insert(organizations)
        .values({
          id: "org1",
          name: "Default",
          settings: settingsJson,
        })
        .run();
    }

    return NextResponse.json({
      success: true,
      smtp: {
        smtp_host,
        smtp_port: smtp_port || 587,
        smtp_user: smtp_user || "",
        smtp_from: smtp_from || smtp_user || "",
        notify_email: notify_email || smtp_user || "",
      },
    });
  } catch (error) {
    console.error("POST /api/admin/smtp error:", error);
    return NextResponse.json({ error: "Грешка при записване на настройки" }, { status: 500 });
  }
}
