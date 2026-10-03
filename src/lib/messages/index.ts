import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createNotification } from "@/lib/notifications";
import { getNotifyEmail, sendEmail, type EmailAttachment } from "@/lib/email";
import { emailLayout, emailText, escapeHtml } from "@/lib/mail-layout";
import { getBankDetails, getSetting, setSetting } from "@/lib/settings";
import { formatMoney } from "@/lib/format";
import { MESSAGES, type MessageDef, type MessageKey } from "./catalog";

export { MESSAGES, type MessageKey } from "./catalog";

/**
 * Всички известия минават оттук — едно събитие, един текст, еднакъв вид
 * в приложението (и push) и по имейл. Текстовете са в catalog.ts; админът
 * може да ги промени от Настройки → Имейли → Съобщения, без код.
 */

type Override = { subject?: string; title?: string; body?: string; app?: boolean; email?: boolean };
const SETTING_KEY = "message_texts";

export function getOverrides(): Partial<Record<MessageKey, Override>> {
  try {
    return JSON.parse(getSetting(SETTING_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveOverride(key: MessageKey, override: Override | null) {
  const all = getOverrides();
  if (!override) delete all[key];
  else {
    const clean: Override = {};
    for (const f of ["subject", "title", "body"] as const) {
      const v = override[f];
      if (typeof v === "string" && v.trim()) clean[f] = v.trim().slice(0, f === "body" ? 2000 : 200);
    }
    for (const f of ["app", "email"] as const) if (typeof override[f] === "boolean") clean[f] = override[f];
    all[key] = clean;
  }
  setSetting(SETTING_KEY, JSON.stringify(all));
}

export type Effective = MessageDef & { subject: string; customized: boolean };

/** Текстът, който реално се праща: промененият от админа или този по подразбиране. */
export function effective(key: MessageKey): Effective {
  const def = MESSAGES[key];
  const o = getOverrides()[key] ?? {};
  return {
    ...def,
    title: o.title ?? def.title,
    body: o.body ?? def.body,
    subject: o.subject ?? def.subject ?? def.title,
    channels: {
      app: def.channels.app && (o.app ?? true),
      email: def.channels.email && (o.email ?? true),
    },
    customized: Object.keys(o).length > 0,
  };
}

type Vars = Record<string, string | number | null | undefined>;

/** {{име}} → стойност; липсваща стойност изчезва, не остава като {{име}}. */
export function render(template: string, vars: Vars): string {
  return template
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => {
      const v = vars[k];
      return v === null || v === undefined ? "" : String(v);
    })
    .replace(/[ \t]+([,.;:!?])/g, "$1")
    .replace(/ {2,}/g, " ")
    .trim();
}

/** Обикновен текст (от админа) → безопасен HTML с нови редове. */
function textToHtml(text: string): string {
  return escapeHtml(text).replace(/\n{2,}/g, "</p><p style=\"color:#334155\">").replace(/\n/g, "<br>");
}

const COLORS = { info: "#006494", ok: "#16a34a", warning: "#d97706", danger: "#dc2626" } as const;

export type Rendered = { subject: string; title: string; body: string; html: string; text: string };

/** Готовият имейл — за изпращане и за прегледа в настройките. */
export function renderMessage(
  key: MessageKey,
  vars: Vars,
  opts: { rows?: [string, string | number | null | undefined][]; link?: string } = {},
): Rendered {
  const m = effective(key);
  const title = render(m.title, vars);
  const body = render(m.body, vars);
  const subject = render(m.subject, vars);
  const cta = m.cta ? { label: render(m.cta.label, vars), path: opts.link ?? m.cta.path } : undefined;
  const html = emailLayout({
    title,
    intro: body ? textToHtml(body) : undefined,
    rows: opts.rows,
    color: COLORS[m.tone ?? "info"],
    cta,
  });
  return { subject, title, body, html, text: emailText({ title, body, rows: opts.rows, cta }) };
}

export type Recipient = string | string[] | "admins";

/**
 * Праща събитието на получателите по каналите му.
 *
 * - потребители (id): в приложението (+ push) и на имейла им;
 * - "admins": в приложението на всички активни админи, имейл — веднъж до
 *   общия адрес на екипа (NOTIFY_EMAIL), не до всеки поотделно;
 * - emailTo: имейл до адрес без профил (напр. запитване от сайта).
 *
 * Никога не хвърля — известието не бива да проваля действието, което го
 * е предизвикало.
 */
export async function notify(
  key: MessageKey,
  opts: {
    to?: Recipient;
    emailTo?: string;
    vars?: Vars;
    link?: string;
    rows?: [string, string | number | null | undefined][];
    attachments?: EmailAttachment[];
    /** Отговор на имейла — напр. до човека от запитването. */
    replyTo?: string;
  },
): Promise<void> {
  try {
    const m = effective(key);
    const vars = opts.vars ?? {};
    const msg = renderMessage(key, vars, { rows: opts.rows, link: opts.link });
    const link = opts.link ?? m.cta?.path ?? "/dashboard";

    const emails = new Set<string>();
    if (opts.to === "admins") {
      const admins = db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, "admin"), eq(users.active, true)))
        .all();
      if (m.channels.app) for (const a of admins) createNotification(a.id, m.type, msg.title, msg.body, link);
      if (m.channels.email) {
        const team = await getNotifyEmail();
        if (team) emails.add(team);
      }
    } else if (opts.to) {
      const ids = Array.isArray(opts.to) ? opts.to : [opts.to];
      for (const id of ids) {
        const u = db.select({ email: users.email, active: users.active }).from(users).where(eq(users.id, id)).get();
        if (!u || u.active === false) continue;
        if (m.channels.app) createNotification(id, m.type, msg.title, msg.body, link);
        if (m.channels.email && u.email && !u.email.endsWith("@deleted.invalid")) emails.add(u.email);
      }
    }
    if (opts.emailTo && m.channels.email) emails.add(opts.emailTo);

    for (const to of emails) {
      await sendEmail({ to, subject: msg.subject, html: msg.html, text: msg.text, replyTo: opts.replyTo, attachments: opts.attachments });
    }
  } catch (err) {
    console.error(`[messages] ${key} failed:`, err);
  }
}

/** Връзка, която отваря точно този имот в приложението на клиента. */
export function propertyLink(propertyId: string): string {
  return `/dashboard?property=${encodeURIComponent(propertyId)}`;
}

/** Данните за превод като редове в имейл — получател, IBAN, банка, сума, основание. */
export function bankRows(reference: string, amount?: number | null): [string, string | number | null | undefined][] {
  const b = getBankDetails();
  return [
    ["Получател", b.recipient],
    ["IBAN", b.iban ?? "ще ви го изпратим"],
    ["Банка", b.bank],
    ["Сума", amount !== undefined && amount !== null ? formatMoney(amount) : null],
    ["Основание", reference],
  ];
}
