import * as nodemailer from "nodemailer";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface SmtpConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  smtp_from: string;
  notify_email: string;
}

/**
 * Get SMTP config — first from env vars, then fallback to DB organizations.settings
 */
async function getSmtpConfig(): Promise<SmtpConfig | null> {
  // 1. Try env vars (production)
  if (process.env.SMTP_HOST) {
    return {
      smtp_host: process.env.SMTP_HOST,
      smtp_port: parseInt(process.env.SMTP_PORT || "587", 10),
      smtp_user: process.env.SMTP_USER || "",
      smtp_pass: process.env.SMTP_PASS || "",
      smtp_from: process.env.SMTP_FROM || process.env.SMTP_USER || "",
      notify_email: process.env.NOTIFY_EMAIL || process.env.SMTP_USER || "",
    };
  }

  // 2. Try DB organizations.settings
  try {
    const [org] = db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, "org1"))
      .all();

    if (org?.settings) {
      const parsed = JSON.parse(org.settings);
      if (parsed.smtp_host) {
        return {
          smtp_host: parsed.smtp_host,
          smtp_port: parsed.smtp_port || 587,
          smtp_user: parsed.smtp_user || "",
          smtp_pass: parsed.smtp_pass || "",
          smtp_from: parsed.smtp_from || parsed.smtp_user || "",
          notify_email: parsed.notify_email || parsed.smtp_user || "",
        };
      }
    }
  } catch {
    // DB might not be ready
  }

  return null;
}

/**
 * Send an email. Fire-and-forget — errors are logged, never thrown.
 * If SMTP is not configured, logs and skips silently.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const config = await getSmtpConfig();

  if (!config) {
    console.log(`[email] SMTP not configured. Skipping email to ${to}: ${subject}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: config.smtp_host,
    port: config.smtp_port,
    secure: config.smtp_port === 465,
    auth: {
      user: config.smtp_user,
      pass: config.smtp_pass,
    },
  });

  // Fire-and-forget: don't await, just log errors
  transporter
    .sendMail({
      from: config.smtp_from,
      to,
      subject,
      html,
    })
    .then((info) => {
      console.log(`[email] Sent to ${to}: ${subject} (msgId: ${info.messageId})`);
    })
    .catch((err) => {
      console.error(`[email] Failed to send to ${to}: ${subject}`, err.message);
    });
}

/** Get the notify/admin email address */
export async function getNotifyEmail(): Promise<string | null> {
  const config = await getSmtpConfig();
  return config?.notify_email || null;
}
