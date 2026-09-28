#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// cron.mjs — периодичните задачи на Ко Манда
//
// Един скрипт за трите задачи от плана (N7, N10):
//   • генерира обходите от абонаментите три месеца напред
//   • маркира изтеклите оферти
//   • праща напомняния (оферти без отговор, неплатена работа)
//
// Вика /api/cron на работещото приложение, за да не се дублира логиката.
// В Coolify (Scheduled Tasks), веднъж на час или на ден:
//   node /app/scripts/cron.mjs
//
// Изисква CRON_SECRET (същата стойност като в приложението).
// ─────────────────────────────────────────────────────────────────────

const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error("[cron] CRON_SECRET липсва — задайте го в средата.");
  process.exit(1);
}

const base = process.env.CRON_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;

try {
  const res = await fetch(`${base}/api/cron`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
  const text = await res.text();
  console.log(`[cron] ${res.status} ${text}`);
  process.exit(res.ok ? 0 : 1);
} catch (err) {
  console.error("[cron] Неуспешна заявка:", err);
  process.exit(1);
}
