import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { getBankDetails, getPrepayThreshold, getSetting, setSetting } from "@/lib/settings";
import { companyInfo } from "@/lib/legal";
import { getNotifyEmail, isEmailConfigured } from "@/lib/email";
import { appUrl } from "@/lib/mail-layout";

function bankView() {
  const b = getBankDetails();
  return { bank_iban: b.iban ?? "", bank_recipient: b.recipient ?? "", bank_name: b.bank ?? "" };
}

export const dynamic = "force-dynamic";

type Check = { key: string; label: string; ok: boolean; level: "required" | "recommended"; detail: string };

/**
 * Готовност за работа с истински клиенти и пари — какво е настроено и какво
 * липсва, с подсказка къде се настройва. Нищо секретно не се връща.
 */
async function readiness(): Promise<Check[]> {
  const company = companyInfo();
  const bank = getBankDetails();
  const key = process.env.STRIPE_SECRET_KEY || "";
  const stripeMode = key.startsWith("sk_live_") || key.startsWith("rk_live_") ? "live" : key ? "test" : null;
  const env = process.env.APP_ENV || "production";
  const lastRun = getSetting("periodic_last_run");
  const hoursSince = lastRun ? (Date.now() - new Date(lastRun).getTime()) / 3_600_000 : null;
  const email = await isEmailConfigured();
  const notify = await getNotifyEmail();
  const companyMissing = [
    !company.name && "COMPANY_NAME",
    !company.eik && "COMPANY_EIK",
    !company.address && "COMPANY_ADDRESS",
    !company.email && "COMPANY_EMAIL",
  ].filter(Boolean);

  return [
    {
      key: "company",
      label: "Данни на фирмата (фактури, условия)",
      ok: companyMissing.length === 0,
      level: "required",
      detail: companyMissing.length ? `Липсват в Coolify: ${companyMissing.join(", ")}` : `${company.name}, ЕИК ${company.eik}`,
    },
    {
      key: "vat",
      label: "Регистрация по ДДС",
      ok: true,
      level: "recommended",
      detail: company.vat
        ? `Да (${company.vat}) — фактурите показват основа и 20% ДДС; цените са с включен ДДС`
        : "Не — фактурите са без ДДС с основание чл. 113, ал. 9 ЗДДС. При регистрация задайте COMPANY_VAT",
    },
    {
      key: "bank",
      label: "Банкова сметка за преводи",
      ok: !!bank.iban && !!bank.recipient,
      level: "required",
      detail: bank.iban ? `${bank.recipient ?? "без получател"} · ${bank.iban}` : "Въведете IBAN и получател по-долу — без тях клиентът не може да плати по банка",
    },
    {
      key: "stripe",
      label: "Плащане с карта (Stripe)",
      ok: !!key && !!process.env.STRIPE_WEBHOOK_SECRET && !(env === "production" && stripeMode === "test") && !(env === "dev" && stripeMode === "live"),
      level: "recommended",
      detail: !key
        ? "Не е настроено — клиентите плащат само по банка (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)"
        : !process.env.STRIPE_WEBHOOK_SECRET
          ? "Липсва STRIPE_WEBHOOK_SECRET — плащанията няма да се отразяват в приложението"
          : env === "production" && stripeMode === "test"
            ? "Внимание: продукцията е с тестов ключ (sk_test_) — истински карти няма да се таксуват"
            : env === "dev" && stripeMode === "live"
              ? "Внимание: тестовата среда е с истински ключ (sk_live_) — ще се таксуват истински карти"
              : `Настроено (${stripeMode === "live" ? "истински плащания" : "тестов режим"})`,
    },
    {
      key: "email",
      label: "Имейли (SMTP)",
      ok: email,
      level: "required",
      detail: email
        ? `Настроено${notify ? ` · известия за екипа към ${notify}` : " · няма адрес за известия на екипа (NOTIFY_EMAIL)"}`
        : "Без SMTP няма потвърждение на регистрация, нова парола, фактури и напомняния по имейл",
    },
    {
      key: "cron",
      label: "Периодични задачи (обходи, напомняния, преводи)",
      ok: !!process.env.CRON_SECRET && hoursSince !== null && hoursSince < 30,
      level: "required",
      detail: !process.env.CRON_SECRET
        ? "CRON_SECRET не е зададен — настройте Scheduled Task в Coolify (DEPLOY §3)"
        : lastRun
          ? `Последно пускане: ${new Date(lastRun).toLocaleString("bg-BG", { timeZone: "Europe/Sofia" })}${hoursSince! >= 30 ? " — не е пускано над ден, проверете Scheduled Task" : ""}`
          : "Още не е пускано — проверете Scheduled Task в Coolify",
    },
    {
      key: "push",
      label: "Push известия на телефона",
      ok: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
      level: "recommended",
      detail: process.env.VAPID_PRIVATE_KEY ? "Настроено" : "Без тях известията са само в приложението и по имейл (VAPID ключове)",
    },
    {
      key: "url",
      label: "Адрес на средата",
      ok: !!process.env.APP_URL || !!process.env.NEXT_PUBLIC_APP_URL,
      level: "required",
      detail: `${appUrl()} (${env === "dev" ? "тестова среда" : "продукция"})`,
    },
  ];
}

/** GET /api/admin/settings — бизнес настройките, които се менят без код. */
export const GET = withAuth({ role: ["admin"] }, async () => {
  return NextResponse.json({
    prepay_threshold: getPrepayThreshold(),
    ...bankView(),
    cron_configured: Boolean(process.env.CRON_SECRET),
    stripe_configured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
    push_configured: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    readiness: await readiness(),
  });
});

/** PATCH /api/admin/settings { prepay_threshold } */
export const PATCH = withAuth({ role: ["admin"] }, async (request) => {
  const body = await request.json().catch(() => ({}));
  if (body.prepay_threshold !== undefined) {
    const n = Number(body.prepay_threshold);
    if (!Number.isFinite(n) || n <= 0 || n > 100000) {
      return NextResponse.json({ error: "Прагът е положителна сума в евро" }, { status: 400 });
    }
    setSetting("prepay_threshold", String(n));
  }
  for (const [key, setting] of [
    ["bank_iban", "bank_iban"],
    ["bank_recipient", "bank_recipient"],
    ["bank_name", "bank_name"],
  ] as const) {
    if (typeof body[key] === "string") setSetting(setting, body[key].trim().slice(0, 120));
  }
  return NextResponse.json({ prepay_threshold: getPrepayThreshold(), ...bankView() });
});
