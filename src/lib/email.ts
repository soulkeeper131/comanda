import * as nodemailer from "nodemailer";
import { db } from "@/db";
import { organizations, settings, properties, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getDefaultOrgId } from "@/lib/org";

export interface SmtpConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  smtp_from: string;
  notify_email: string;
}

async function getOrgSettings(): Promise<Record<string, any>> {
  try {
    const orgId = getDefaultOrgId();
    const [org] = db.select({ settings: organizations.settings }).from(organizations).where(eq(organizations.id, orgId)).all();
    if (org?.settings) return JSON.parse(org.settings);
  } catch {}
  return {};
}

/** Read a settings map from the dedicated settings table */
async function getSettingsTableMap(): Promise<Record<string, string>> {
  try {
    const rows = db.select({ key: settings.key, value: settings.value }).from(settings).all();
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return map;
  } catch { return {}; }
}

async function getSmtpConfig(): Promise<SmtpConfig | null> {
  // 1) Environment variables first
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
  // 2) Dedicated settings table
  const tableMap = await getSettingsTableMap();
  if (tableMap.smtp_host) {
    return {
      smtp_host: tableMap.smtp_host,
      smtp_port: parseInt(tableMap.smtp_port || "587", 10),
      smtp_user: tableMap.smtp_user || "",
      smtp_pass: tableMap.smtp_pass || "",
      smtp_from: tableMap.smtp_from || tableMap.smtp_user || "",
      notify_email: tableMap.notify_email || tableMap.smtp_user || "",
    };
  }
  // 3) Legacy: organizations.settings JSON
  const orgSettings = await getOrgSettings();
  if (orgSettings.smtp_host) {
    return {
      smtp_host: orgSettings.smtp_host,
      smtp_port: orgSettings.smtp_port || 587,
      smtp_user: orgSettings.smtp_user || "",
      smtp_pass: orgSettings.smtp_pass || "",
      smtp_from: orgSettings.smtp_from || orgSettings.smtp_user || "",
      notify_email: orgSettings.notify_email || orgSettings.smtp_user || "",
    };
  }
  return null;
}

/** Настроен ли е SMTP — без него потвърждение по имейл е невъзможно. */
export async function isEmailConfigured(): Promise<boolean> {
  return (await getSmtpConfig()) !== null;
}

export type EmailAttachment = { filename: string; content: Buffer; contentType?: string };

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
  attachments,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}): Promise<void> {
  if (!to) return;
  const config = await getSmtpConfig();
  if (!config) { console.log(`[email] SMTP not configured. Skip: ${subject}`); return; }
  // Тестовата среда си личи и в пощата — да не се бърка с истински клиент.
  if (process.env.APP_ENV === "dev" && !subject.startsWith("[ТЕСТ]")) subject = `[ТЕСТ] ${subject}`;
  // Отговор на имейл стига до фирмената поща, не до техническия адрес.
  replyTo = replyTo || process.env.COMPANY_EMAIL || undefined;

  const transporter = nodemailer.createTransport({
    host: config.smtp_host, port: config.smtp_port,
    secure: config.smtp_port === 465,
    // Без потребител — сървър без вход (напр. вътрешен релей).
    auth: config.smtp_user ? { user: config.smtp_user, pass: config.smtp_pass } : undefined,
  });

  transporter.sendMail({ from: config.smtp_from, to, subject, html, text, replyTo, attachments })
    .then((info) => console.log(`[email] Sent: ${subject} (${info.messageId})`))
    .catch((err) => console.error(`[email] Fail: ${subject}`, err.message));
}

export async function getNotifyEmail(): Promise<string | null> {
  const config = await getSmtpConfig();
  return config?.notify_email || null;
}

/** Имейлът на собственика на имота, ако има такъв. */
export function ownerEmailFor(propertyId: string): string | null {
  const property = db.select().from(properties).where(eq(properties.id, propertyId)).get();
  if (!property) return null;
  const owner = db.select().from(users).where(eq(users.id, property.owner_id)).get();
  return owner?.email ?? null;
}

/** Откъде идват настройките на имейл сървъра — Coolify (среда) или админ панела. */
export async function smtpSource(): Promise<"env" | "db" | null> {
  if (process.env.SMTP_HOST) return "env";
  return (await getSmtpConfig()) ? "db" : null;
}

/**
 * Истинска проверка на имейл сървъра: свързване, вход и изпращане, с
 * изчакване на отговора. За бутона „Тест" — sendEmail не чака доставката.
 */
export async function sendTestEmail(to: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = await getSmtpConfig();
  if (!config) return { ok: false, error: "Имейл сървърът (SMTP) не е настроен" };
  const transporter = nodemailer.createTransport({
    host: config.smtp_host,
    port: config.smtp_port,
    secure: config.smtp_port === 465,
    // Без потребител — сървър без вход (напр. вътрешен релей).
    auth: config.smtp_user ? { user: config.smtp_user, pass: config.smtp_pass } : undefined,
  });
  try {
    await transporter.verify();
    await transporter.sendMail({
      from: config.smtp_from,
      to,
      subject: "Пробен имейл от Ко Манда",
      text: "Имейл сървърът работи. Това е пробен имейл от Ко Манда.",
      html: '<div style="font-family:sans-serif;padding:24px"><h2 style="color:#006494">Имейл сървърът работи</h2><p>Това е пробен имейл от Ко Манда.</p></div>',
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
