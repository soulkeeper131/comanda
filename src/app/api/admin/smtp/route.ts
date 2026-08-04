import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAllTemplates } from "@/lib/email";

export const dynamic = "force-dynamic";

// GET /api/admin/smtp — returns SMTP settings + email templates
export async function GET() {
  try {
    const [org] = db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, "org1"))
      .all();

    let smtp = null;
    if (org?.settings) {
      const parsed = JSON.parse(org.settings);
      if (parsed.smtp_host) {
        smtp = {
          smtp_host: parsed.smtp_host,
          smtp_port: parsed.smtp_port || 587,
          smtp_user: parsed.smtp_user || "",
          smtp_from: parsed.smtp_from || "",
          notify_email: parsed.notify_email || "",
        };
      }
    }

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

    // Get existing settings
    const [existing] = db
      .select({ id: organizations.id, settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, "org1"))
      .all();

    let current: Record<string, unknown> = {};
    if (existing?.settings) {
      try { current = JSON.parse(existing.settings); } catch { current = {}; }
    }

    // Only update SMTP if host is provided
    if (smtp_host) {
      current.smtp_host = smtp_host;
      current.smtp_port = smtp_port || 587;
      current.smtp_user = smtp_user || "";
      if (smtp_pass) current.smtp_pass = smtp_pass;
      current.smtp_from = smtp_from || smtp_user || "";
      current.notify_email = notify_email || smtp_user || "";
    }

    // Update email templates if provided
    if (email_templates) {
      current.email_templates = email_templates;
    }

    const json = JSON.stringify(current);

    if (existing) {
      db.update(organizations).set({ settings: json }).where(eq(organizations.id, "org1")).run();
    } else {
      db.insert(organizations).values({ id: "org1", name: "Default", settings: json }).run();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/admin/smtp error:", error);
    return NextResponse.json({ error: "Грешка" }, { status: 500 });
  }
}
