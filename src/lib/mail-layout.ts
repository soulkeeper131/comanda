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

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://comanda.bg").replace(/\/$/, "");
}

export function formatEur(amount: number | null | undefined): string {
  const n = Number(amount ?? 0);
  return `${n.toFixed(2).replace(/\.00$/, "")} €`;
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
<p style="color:#94a3b8;font-size:12px">Ко Манда — comanda.bg</p>
</div>`;
}
