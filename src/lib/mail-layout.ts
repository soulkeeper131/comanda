import { formatMoney } from "@/lib/format";
import { companyInfo } from "@/lib/legal";
/**
 * Общ вид на известията по имейл + екраниране.
 *
 * Всичко, което идва от потребител (заглавие на констатация, описание,
 * обхват на оферта), минава през escapeHtml — иначе всеки може да вкара
 * HTML/линкове в имейл, изпратен от името на фирмата.
 */

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Адресът на тази среда — https://comanda.bg в продукция,
 * https://dev.comanda.bg в тестовата. APP_URL се чете при работа;
 * NEXT_PUBLIC_* се вгражда при build и затова е само резервен вариант.
 */
export function appUrl(): string {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://comanda.bg").replace(/\/$/, "");
}

export function appHost(): string {
  return appUrl().replace(/^https?:\/\//, "");
}

/** Същият формат като в приложението ("12,50 €"). */
export function formatEur(amount: number | null | undefined): string {
  return formatMoney(Number(amount ?? 0));
}

type Row = [label: string, value: string | number | null | undefined];

/**
 * Имейл с заглавие, редове „етикет: стойност" и бутон към приложението.
 * Стойностите в `rows` се екранират тук; `intro` се приема като вече
 * безопасен HTML (съставя се от кода, не от потребителя).
 */
export function emailLayout(opts: {
  title: string;
  intro?: string;
  rows?: Row[];
  color?: string;
  cta?: { label: string; path?: string };
}): string {
  const color = opts.color ?? "#006494";
  const rows = (opts.rows ?? [])
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(
      ([label, value]) =>
        `<p style="color:#247ba0;margin:6px 0"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`,
    )
    .join("");
  const cta = opts.cta
    ? `<p style="margin:20px 0"><a href="${appUrl()}${opts.cta.path ?? "/dashboard"}" style="display:inline-block;padding:12px 24px;background:#1b98e0;color:#fff;border-radius:8px;text-decoration:none">${escapeHtml(opts.cta.label)}</a></p>`
    : "";
  return `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
<h2 style="color:${color}">${escapeHtml(opts.title)}</h2>
${opts.intro ? `<p style="color:#334155">${opts.intro}</p>` : ""}
${rows}
${cta}
<hr style="border:none;border-top:1px solid #e4e9f0;margin:20px 0" />
<p style="color:#94a3b8;font-size:12px;line-height:1.6">${footerLines().map(escapeHtml).join("<br>")}<br><a href="${appUrl()}/privacy" style="color:#94a3b8">Поверителност</a></p>
</div>`;
}

/** Подписът под всеки имейл — фирмата и как да се свържат с нас. */
export function footerLines(): string[] {
  const c = companyInfo();
  return [
    [c.name || "Ко Манда", appHost()].join(" · "),
    [c.email, c.phone].filter(Boolean).join(" · "),
  ].filter(Boolean);
}

/** Текстовата версия на имейла — за пощенски програми без HTML и по-малко спам. */
export function emailText(opts: {
  title: string;
  body?: string;
  rows?: Row[];
  cta?: { label: string; path?: string };
}): string {
  const rows = (opts.rows ?? [])
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([l, v]) => `${l}: ${v}`);
  return [
    opts.title,
    "",
    opts.body ?? "",
    rows.length ? "" : null,
    ...rows,
    opts.cta ? `\n${opts.cta.label}: ${appUrl()}${opts.cta.path ?? "/dashboard"}` : null,
    "",
    "--",
    ...footerLines(),
  ]
    .filter((l) => l !== null)
    .join("\n");
}
