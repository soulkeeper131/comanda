import * as nodemailer from "nodemailer";
import { db } from "@/db";
import { organizations, settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface SmtpConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  smtp_from: string;
  notify_email: string;
}

interface EmailTemplate {
  subject: string;
  html: string;
}

export type TemplateKey = "welcome" | "job_assigned" | "job_completed" | "finding_new" | "offer_new" | "offer_decided" | "inquiry_new";

const DEFAULT_TEMPLATES: Record<TemplateKey, EmailTemplate> = {
  welcome: {
    subject: "Добре дошли в Ко Манда!",
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#e8f1f2;border-radius:12px">
<h2 style="color:#006494">🏠 Ко Манда</h2>
<p>Здравей, <strong>{{name}}</strong>!</p>
<p>Твоят профил е създаден успешно. Вече можеш да влезеш в приложението и да:</p>
<ul><li>Разглеждаш имотите си</li><li>Следиш обходите</li><li>Получаваш оферти за ремонт</li></ul>
<a href="https://comanda.blv.bg/login" style="display:inline-block;padding:12px 24px;background:#1b98e0;color:#fff;border-radius:8px;text-decoration:none">Влез в приложението</a>
</div>`
  },
  job_assigned: {
    subject: "📋 Възложен нов обход на {{property}}",
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#e8f1f2;border-radius:12px">
<h2 style="color:#006494">📋 Нов обход</h2>
<p>Възложен е обход на <strong>{{property}}</strong> за <strong>{{date}}</strong>.</p>
<p>Изпълнител: {{worker}}</p>
<a href="https://comanda.blv.bg/login" style="display:inline-block;padding:12px 24px;background:#1b98e0;color:#fff;border-radius:8px;text-decoration:none">Виж в приложението</a>
</div>`
  },
  job_completed: {
    subject: "✅ Обходът на {{property}} е завършен",
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#e8f1f2;border-radius:12px">
<h2 style="color:#006494">✅ Обход завършен</h2>
<p>Обходът на <strong>{{property}}</strong> е завършен успешно от {{worker}}.</p>
<p>Времетраене: {{duration}} мин</p>
<a href="https://comanda.blv.bg/login" style="display:inline-block;padding:12px 24px;background:#1b98e0;color:#fff;border-radius:8px;text-decoration:none">Виж отчета</a>
</div>`
  },
  finding_new: {
    subject: "⚠️ Нова констатация в {{property}}: {{title}}",
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#fff3cd;border-radius:12px;border:1px solid #ffc107">
<h2 style="color:#856404">⚠️ Констатация</h2>
<p><strong>{{property}}</strong></p>
<p>{{title}}</p>
<p>{{body}}</p>
<a href="https://comanda.blv.bg/login" style="display:inline-block;padding:12px 24px;background:#d97706;color:#fff;border-radius:8px;text-decoration:none">Виж детайли</a>
</div>`
  },
  offer_new: {
    subject: "💰 Нова оферта за {{property}}: {{price}}€",
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#e8f1f2;border-radius:12px">
<h2 style="color:#006494">💰 Нова оферта</h2>
<p><strong>{{property}}</strong></p>
<p>Сума: <strong>{{price}}€</strong> | Срок: {{days}} дни</p>
<p>{{scope}}</p>
<a href="https://comanda.blv.bg/login" style="display:inline-block;padding:12px 24px;background:#1b98e0;color:#fff;border-radius:8px;text-decoration:none">Виж и отговори</a>
</div>`
  },
  offer_decided: {
    subject: "{{decision}} оферта за {{property}}",
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#e8f1f2;border-radius:12px">
<h2 style="color:#006494">{{decision}} оферта</h2>
<p>Офертата за <strong>{{property}}</strong> ({{price}}€) е <strong>{{decision_lower}}</strong>.</p>
<a href="https://comanda.blv.bg/login" style="display:inline-block;padding:12px 24px;background:#1b98e0;color:#fff;border-radius:8px;text-decoration:none">Виж в приложението</a>
</div>`
  },
  inquiry_new: {
    subject: "📩 Ново запитване от {{name}}",
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#e8f1f2;border-radius:12px">
<h2 style="color:#006494">📩 Ново запитване</h2>
<p><strong>{{name}}</strong> | {{email}} | {{phone}}</p>
<p>{{message}}</p>
</div>`
  },
};

async function getOrgSettings(): Promise<Record<string, any>> {
  try {
    const [org] = db.select({ settings: organizations.settings }).from(organizations).where(eq(organizations.id, "org1")).all();
    if (org?.settings) return JSON.parse(org.settings);
  } catch {}
  return {};
}

async function getSmtpConfig(): Promise<SmtpConfig | null> {
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
  const settings = await getOrgSettings();
  if (settings.smtp_host) {
    return {
      smtp_host: settings.smtp_host,
      smtp_port: settings.smtp_port || 587,
      smtp_user: settings.smtp_user || "",
      smtp_pass: settings.smtp_pass || "",
      smtp_from: settings.smtp_from || settings.smtp_user || "",
      notify_email: settings.notify_email || settings.smtp_user || "",
    };
  }
  return null;
}

/** Get template from DB settings or default */
async function getTemplate(key: TemplateKey): Promise<EmailTemplate> {
  const settings = await getOrgSettings();
  const templates = settings.email_templates || {};
  return templates[key] || DEFAULT_TEMPLATES[key];
}

/** Render template with variables {{var}} */
function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`);
}

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<void> {
  const config = await getSmtpConfig();
  if (!config) { console.log(`[email] SMTP not configured. Skip: ${subject}`); return; }

  const transporter = nodemailer.createTransport({
    host: config.smtp_host, port: config.smtp_port,
    secure: config.smtp_port === 465,
    auth: { user: config.smtp_user, pass: config.smtp_pass },
  });

  transporter.sendMail({ from: config.smtp_from, to, subject, html })
    .then((info) => console.log(`[email] Sent: ${subject} (${info.messageId})`))
    .catch((err) => console.error(`[email] Fail: ${subject}`, err.message));
}

/** Send templated email */
export async function sendTemplatedEmail(key: TemplateKey, to: string, vars: Record<string, string>) {
  const tpl = await getTemplate(key);
  const html = render(tpl.html, vars);
  const subject = render(tpl.subject, vars);
  return sendEmail({ to, subject, html });
}

export async function getNotifyEmail(): Promise<string | null> {
  const config = await getSmtpConfig();
  return config?.notify_email || null;
}

/** Get all templates (for admin UI) */
export async function getAllTemplates(): Promise<Record<string, EmailTemplate>> {
  const settings = await getOrgSettings();
  const saved = settings.email_templates || {};
  const all: Record<string, EmailTemplate> = {};
  for (const key of Object.keys(DEFAULT_TEMPLATES) as TemplateKey[]) {
    all[key] = saved[key] || DEFAULT_TEMPLATES[key];
  }
  return all;
}

export const TEMPLATE_LABELS: Record<string, string> = {
  welcome: "🎉 Регистрация",
  job_assigned: "📋 Възложен обход",
  job_completed: "✅ Завършен обход",
  finding_new: "⚠️ Нова констатация",
  offer_new: "💰 Нова оферта",
  offer_decided: "✅ Приета/отказана оферта",
  inquiry_new: "📩 Ново запитване",
};
